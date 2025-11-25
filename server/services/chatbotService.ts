import OpenAI from "openai";
import { db } from "../db";
import { games, teams, tournaments, diamonds } from "@shared/schema";
import { eq } from "drizzle-orm";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface TournamentContext {
  tournament: any;
  teams: any[];
  games: any[];
  diamonds: any[];
}

interface ComputedStanding {
  teamId: string;
  teamName: string;
  pool: string;
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
}

export class ChatbotService {
  private async buildTournamentContext(tournamentId: string): Promise<TournamentContext | null> {
    try {
      const [tournament] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId));

      if (!tournament) {
        return null;
      }

      const tournamentTeams = await db
        .select()
        .from(teams)
        .where(eq(teams.tournamentId, tournamentId));

      const tournamentGames = await db
        .select()
        .from(games)
        .where(eq(games.tournamentId, tournamentId));

      const tournamentDiamonds = tournament.organizationId
        ? await db
            .select()
            .from(diamonds)
            .where(eq(diamonds.organizationId, tournament.organizationId))
        : [];

      return {
        tournament,
        teams: tournamentTeams,
        games: tournamentGames,
        diamonds: tournamentDiamonds,
      };
    } catch (error) {
      console.error("Error building tournament context:", error);
      return null;
    }
  }

  private computeStandings(teams: any[], games: any[]): ComputedStanding[] {
    const standingsMap = new Map<string, ComputedStanding>();
    
    teams.forEach((team) => {
      standingsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        pool: team.pool || "Unassigned",
        wins: 0,
        losses: 0,
        ties: 0,
        runsScored: 0,
        runsAllowed: 0,
      });
    });

    games.filter((g) => g.status === "completed" && g.homeScore != null && g.awayScore != null)
      .forEach((game) => {
        const homeStanding = standingsMap.get(game.homeTeamId);
        const awayStanding = standingsMap.get(game.awayTeamId);
        
        if (homeStanding) {
          homeStanding.runsScored += game.homeScore || 0;
          homeStanding.runsAllowed += game.awayScore || 0;
          if (game.homeScore > game.awayScore) homeStanding.wins++;
          else if (game.homeScore < game.awayScore) homeStanding.losses++;
          else homeStanding.ties++;
        }
        
        if (awayStanding) {
          awayStanding.runsScored += game.awayScore || 0;
          awayStanding.runsAllowed += game.homeScore || 0;
          if (game.awayScore > game.homeScore) awayStanding.wins++;
          else if (game.awayScore < game.homeScore) awayStanding.losses++;
          else awayStanding.ties++;
        }
      });

    return Array.from(standingsMap.values());
  }

  private formatContextForPrompt(context: TournamentContext): string {
    const { tournament, teams, games, diamonds } = context;

    let contextStr = `TOURNAMENT INFORMATION:
Name: ${tournament.name}
Start Date: ${tournament.startDate || "Not set"}
End Date: ${tournament.endDate || "Not set"}
Location: ${tournament.city || "Not specified"}
Status: ${tournament.status || "active"}

`;

    if (teams.length > 0) {
      contextStr += `TEAMS (${teams.length} total):\n`;
      const teamsByPool: Record<string, any[]> = {};
      teams.forEach((team) => {
        const pool = team.pool || "Unassigned";
        if (!teamsByPool[pool]) teamsByPool[pool] = [];
        teamsByPool[pool].push(team);
      });
      
      Object.entries(teamsByPool).forEach(([pool, poolTeams]) => {
        contextStr += `\nPool ${pool}:\n`;
        poolTeams.forEach((team) => {
          contextStr += `- ${team.name} (Seed: ${team.seed || "N/A"})`;
          if (team.coach) contextStr += ` - Coach: ${team.coach}`;
          contextStr += "\n";
        });
      });
      contextStr += "\n";
    }

    const standings = this.computeStandings(teams, games);
    if (standings.length > 0) {
      contextStr += `CURRENT STANDINGS:\n`;
      const standingsByPool: Record<string, ComputedStanding[]> = {};
      standings.forEach((s) => {
        if (!standingsByPool[s.pool]) standingsByPool[s.pool] = [];
        standingsByPool[s.pool].push(s);
      });
      
      Object.entries(standingsByPool).forEach(([pool, poolStandings]) => {
        contextStr += `\nPool ${pool}:\n`;
        const sorted = poolStandings.sort((a, b) => {
          const aWinPct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
          const bWinPct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
          if (bWinPct !== aWinPct) return bWinPct - aWinPct;
          return (b.runsScored - b.runsAllowed) - (a.runsScored - a.runsAllowed);
        });
        sorted.forEach((s, rank) => {
          contextStr += `${rank + 1}. ${s.teamName}: ${s.wins}W-${s.losses}L-${s.ties}T (RS: ${s.runsScored}, RA: ${s.runsAllowed})\n`;
        });
      });
      contextStr += "\n";
    }

    if (games.length > 0) {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      
      const upcomingGames = games
        .filter((g) => g.date && g.date >= today && g.status !== "completed")
        .sort((a, b) => {
          if (a.date !== b.date) return a.date!.localeCompare(b.date!);
          return (a.time || "").localeCompare(b.time || "");
        })
        .slice(0, 10);

      const recentGames = games
        .filter((g) => g.status === "completed")
        .sort((a, b) => {
          if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
          return (b.time || "").localeCompare(a.time || "");
        })
        .slice(0, 10);

      if (upcomingGames.length > 0) {
        contextStr += `UPCOMING GAMES:\n`;
        upcomingGames.forEach((game) => {
          const homeTeam = teams.find((t) => t.id === game.homeTeamId);
          const awayTeam = teams.find((t) => t.id === game.awayTeamId);
          const diamond = diamonds.find((d) => d.id === game.diamondId);
          contextStr += `- ${game.date} at ${game.time || "TBD"}: ${awayTeam?.name || "TBD"} vs ${homeTeam?.name || "TBD"}`;
          if (diamond) contextStr += ` @ ${diamond.name}`;
          if (game.round) contextStr += ` (${game.round})`;
          contextStr += "\n";
        });
        contextStr += "\n";
      }

      if (recentGames.length > 0) {
        contextStr += `RECENT RESULTS:\n`;
        recentGames.forEach((game) => {
          const homeTeam = teams.find((t) => t.id === game.homeTeamId);
          const awayTeam = teams.find((t) => t.id === game.awayTeamId);
          contextStr += `- ${game.date}: ${awayTeam?.name || "TBD"} ${game.awayScore ?? "-"} vs ${homeTeam?.name || "TBD"} ${game.homeScore ?? "-"}`;
          if (game.round) contextStr += ` (${game.round})`;
          contextStr += "\n";
        });
        contextStr += "\n";
      }
    }

    if (diamonds.length > 0) {
      contextStr += `DIAMOND LOCATIONS:\n`;
      diamonds.forEach((diamond) => {
        contextStr += `- ${diamond.name}`;
        if (diamond.address) contextStr += `: ${diamond.address}`;
        if (diamond.latitude && diamond.longitude) {
          contextStr += ` (GPS: ${diamond.latitude}, ${diamond.longitude})`;
        }
        contextStr += "\n";
      });
    }

    return contextStr;
  }

  private buildSystemPrompt(context: TournamentContext): string {
    const tournamentData = this.formatContextForPrompt(context);

    return `You are a helpful tournament assistant for "${context.tournament.name}". Your role is to answer questions about the tournament including:
- Game schedules and times
- Team information and rosters
- Current standings and rankings
- Diamond/field locations and directions
- Playoff brackets and seeding
- Tournament rules and format

IMPORTANT GUIDELINES:
1. Only answer questions related to THIS tournament. Politely redirect off-topic questions.
2. Be concise and direct in your answers.
3. If you don't have the information requested, say so clearly.
4. Format times and dates in a user-friendly way.
5. When giving directions or locations, include the full address if available.
6. Do not make up information that isn't in the provided context.
7. Be friendly and supportive - remember this is a youth baseball/softball tournament.

CURRENT TOURNAMENT DATA:
${tournamentData}

Remember: You have READ-ONLY access to tournament data. You cannot modify schedules, scores, or any other data.`;
  }

  async chat(
    tournamentId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<{ response: string; error?: string }> {
    try {
      const context = await this.buildTournamentContext(tournamentId);

      if (!context) {
        return {
          response: "I'm sorry, I couldn't find information about this tournament. Please make sure you're accessing a valid tournament page.",
          error: "Tournament not found",
        };
      }

      const systemPrompt = this.buildSystemPrompt(context);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-10).map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: userMessage },
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages,
        max_completion_tokens: 1024,
      });

      const assistantMessage = response.choices[0]?.message?.content;

      if (!assistantMessage) {
        return {
          response: "I'm sorry, I couldn't generate a response. Please try again.",
          error: "Empty response from AI",
        };
      }

      return { response: assistantMessage };
    } catch (error: any) {
      console.error("Chatbot error:", error);
      
      if (error?.message?.includes("429") || error?.message?.includes("rate limit")) {
        return {
          response: "I'm experiencing high demand right now. Please try again in a moment.",
          error: "Rate limited",
        };
      }

      return {
        response: "I'm having trouble processing your request. Please try again later.",
        error: error?.message || "Unknown error",
      };
    }
  }

  async getQuickAnswers(tournamentId: string): Promise<string[]> {
    return [
      "When is my next game?",
      "What are the current standings?",
      "Where is Diamond 1 located?",
      "What time do playoffs start?",
      "Who is in Pool A?",
    ];
  }
}

export const chatbotService = new ChatbotService();
