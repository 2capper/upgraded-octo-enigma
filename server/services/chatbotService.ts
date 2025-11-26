import OpenAI from "openai";
import { db } from "../db";
import { games, teams, tournaments, diamonds } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UserContext {
  id?: string;
  role?: string;
  name?: string;
}

interface TournamentContext {
  tournament: any;
  teams: any[];
  games: any[];
  diamonds: any[];
  userContext?: UserContext;
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
    const { tournament, teams, games, diamonds, userContext } = context;

    let userTeam: any = null;
    if (userContext?.name) {
      const nameParts = userContext.name.toLowerCase().split(' ');
      userTeam = teams.find(t => {
        const coach = (t.coach || "").toLowerCase();
        const manager = (t.managerName || "").toLowerCase();
        const assistant = (t.assistantName || "").toLowerCase();
        return nameParts.some(part => 
          part.length > 2 && (coach.includes(part) || manager.includes(part) || assistant.includes(part))
        );
      });
    }

    let contextStr = `TOURNAMENT: ${tournament.name}
LOCATION: ${tournament.city || "Not specified"}
DATES: ${tournament.startDate} to ${tournament.endDate}
`;

    if (userContext) {
      contextStr += `\nCURRENT USER: ${userContext.name || "Guest"} (${userContext.role || "Visitor"})\n`;
      if (userTeam) {
        contextStr += `ASSOCIATED TEAM: ${userTeam.name} (The user is likely the coach/manager of this team. Prioritize this team's schedule when they say "my game" or "our team".)\n`;
      }
    }

    if (diamonds.length > 0) {
      contextStr += `\nLOCATIONS:\n`;
      diamonds.forEach((d) => {
        contextStr += `- ${d.name}: ${d.address || "No address set"}`;
        if (d.latitude && d.longitude) {
          contextStr += ` (GPS: ${d.latitude}, ${d.longitude})`;
        }
        contextStr += "\n";
      });
    }

    const standings = this.computeStandings(teams, games);
    if (standings.length > 0) {
      contextStr += `\nSTANDINGS:\n`;
      const standingsByPool: Record<string, ComputedStanding[]> = {};
      standings.forEach((s) => {
        if (!standingsByPool[s.pool]) standingsByPool[s.pool] = [];
        standingsByPool[s.pool].push(s);
      });
      
      Object.entries(standingsByPool).forEach(([pool, poolStandings]) => {
        contextStr += `[Pool ${pool}]\n`;
        const sorted = poolStandings.sort((a, b) => {
          const aWinPct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
          const bWinPct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
          if (bWinPct !== aWinPct) return bWinPct - aWinPct;
          return (b.runsScored - b.runsAllowed) - (a.runsScored - a.runsAllowed);
        });
        sorted.forEach((s, rank) => {
          contextStr += `${rank + 1}. ${s.teamName} (${s.wins}-${s.losses}-${s.ties})\n`;
        });
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    const upcoming = games
      .filter(g => g.date >= today && g.status !== 'completed')
      .sort((a, b) => {
        if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
        return (a.time || "").localeCompare(b.time || "");
      });
    
    const completed = games
      .filter(g => g.status === 'completed')
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    contextStr += `\nSCHEDULE:\n`;
    
    if (userTeam) {
      const myGames = upcoming.filter(g => g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id);
      if (myGames.length > 0) {
        contextStr += `*** YOUR UPCOMING GAMES ***\n`;
        myGames.forEach(g => {
          const home = teams.find(t => t.id === g.homeTeamId)?.name;
          const away = teams.find(t => t.id === g.awayTeamId)?.name;
          const diamond = diamonds.find(d => d.id === g.diamondId)?.name || "TBD";
          contextStr += `- ${g.date} @ ${g.time || "TBD"}: ${away} vs ${home} (at ${diamond})`;
          if (g.round) contextStr += ` [${g.round}]`;
          contextStr += "\n";
        });
        contextStr += `***************************\n`;
      }
    }

    contextStr += `ALL UPCOMING GAMES (Next 15):\n`;
    upcoming.slice(0, 15).forEach(g => {
      const home = teams.find(t => t.id === g.homeTeamId)?.name;
      const away = teams.find(t => t.id === g.awayTeamId)?.name;
      const diamond = diamonds.find(d => d.id === g.diamondId)?.name || "TBD";
      contextStr += `- ${g.date} @ ${g.time || "TBD"}: ${away} vs ${home} (at ${diamond})`;
      if (g.round) contextStr += ` [${g.round}]`;
      contextStr += "\n";
    });

    if (completed.length > 0) {
      contextStr += `\nRECENT RESULTS (Last 10):\n`;
      completed.slice(0, 10).forEach(g => {
        const home = teams.find(t => t.id === g.homeTeamId)?.name;
        const away = teams.find(t => t.id === g.awayTeamId)?.name;
        contextStr += `- ${g.date}: ${away} ${g.awayScore ?? "-"} vs ${home} ${g.homeScore ?? "-"}`;
        if (g.round) contextStr += ` [${g.round}]`;
        contextStr += "\n";
      });
    }

    return contextStr;
  }

  private buildSystemPrompt(context: TournamentContext): string {
    const tournamentData = this.formatContextForPrompt(context);

    return `You are the official AI Assistant for the "${context.tournament.name}".
Your goal is to help parents, coaches, and fans navigate the tournament.

DATA CONTEXT:
${tournamentData}

INSTRUCTIONS:
1. **Identity:** You are friendly, professional, and concise.
2. **User Context:** If the user is identified as a Coach (see "CURRENT USER" above), address them warmly. If we identified their team ("ASSOCIATED TEAM"), assume "we", "my game", or "our next game" refers to that team.
3. **Directions:** If asked for location/directions, provide the specific address from the LOCATIONS section.
4. **Unknowns:** If you don't have an answer (e.g., a score for a game not in the list), say "I don't have that information yet." Do NOT guess.
5. **Emergency:** If asked about medical/safety, tell them to call 911 or find a Tournament Official immediately.
6. **Stay On Topic:** Only answer questions about THIS tournament. Politely redirect off-topic questions.

Keep responses short (under 3 sentences) unless asked for a full list or detailed schedule.`;
  }

  async chat(
    tournamentId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    userContext?: UserContext
  ): Promise<{ response: string; error?: string }> {
    try {
      const context = await this.buildTournamentContext(tournamentId);

      if (!context) {
        return {
          response: "I'm sorry, I couldn't find information about this tournament. Please make sure you're accessing a valid tournament page.",
          error: "Tournament not found",
        };
      }

      context.userContext = userContext;

      const systemPrompt = this.buildSystemPrompt(context);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-6).map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: userMessage },
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages,
        max_completion_tokens: 500,
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
