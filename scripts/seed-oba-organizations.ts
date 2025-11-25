import { db } from "../server/db";
import { organizations } from "../shared/schema";
import { nanoid } from "nanoid";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

const obaOrganizations = [
  { name: "Ajax Spartans Minor Baseball Association", website: "www.ajaxbaseball.com", address: "15-75 Bayly St W Suite 253", city: "Ajax" },
  { name: "Alexander Park Baseball", website: "www.alexanderpark.ca", address: "201 Whitney Ave", city: "Hamilton" },
  { name: "Alvinston Minor Baseball", website: "www.alvinstonminorball.ca", address: "3310 Walnut St", city: "Alvinston" },
  { name: "Amherstburg Minor Baseball Association", website: "www.amherstburgcardinals.com", address: "3295 Meloche Road", city: "Amherstburg" },
  { name: "Ancaster Baseball Association", website: "www.ancasterbaseball.ca", address: "268 Jerseyville Rd W", city: "Ancaster" },
  { name: "Ancaster Little League", website: "www.ancasterlittleleague.com", address: "268 Jerseyville Rd W", city: "Ancaster" },
  { name: "Angus Minor Baseball", website: null, address: null, city: "Angus" },
  { name: "Annette Baseball Association", website: "www.annettebaseball.com", address: "290 Clendenan Ave", city: "Toronto" },
  { name: "Arthur Minor Baseball", website: "www.arthurminorball.ca", address: "308 Tucker Street", city: "Arthur" },
  { name: "Aurora King Baseball Association", website: "www.akba.ca", address: "123 Murray Drive", city: "Aurora" },
  { name: "Aylmer Minor Baseball", website: "www.aylmerminorball.com", address: "150 Tarry Pkwy", city: "Aylmer" },
  { name: "Barrie Minor Baseball", website: "www.barriebaseball.com", address: "49 Truman Road Door 32", city: "Barrie" },
  { name: "Beamsville Minor Baseball", website: "www.beamsvilleminorbaseball.com", address: "5100 Fly Rd", city: "Beamsville" },
  { name: "Beaver Valley", website: "www.bvaa.ca", address: "119 Alfred St W", city: "Beaver" },
  { name: "Belleville Amateur Baseball Association", website: null, address: "315 Bridge St W", city: "Belleville" },
  { name: "Binbrook Minor Baseball Association", website: null, address: "1040 Golf Club Road", city: "Binbrook" },
  { name: "Birchmount Baseball League", website: null, address: "93 Birchmount Road, Scarborough", city: "Birchmount" },
  { name: "Blenheim and District Minor Baseball Association", website: null, address: "199 King St", city: "Blenheim" },
  { name: "Bloordale Baseball League", website: null, address: "4370 Bloor St W", city: "Bloordale" },
  { name: "Bradford Minor Baseball Association", website: null, address: "3541 11th Line", city: "Bradford" },
  { name: "Brampton Minor Baseball Inc", website: null, address: "8850 McLaughlin Road South", city: "Brampton" },
  { name: "Brantford Minor Baseball Association", website: "www.brantfordbaseball.ca", address: "35 Sherwood Dr", city: "Brantford" },
  { name: "Brighton Baseball Association", website: null, address: "75 Elizabeth St", city: "Brighton" },
  { name: "Brights Grove Baseball Association", website: null, address: "3111 Egremont Rd.", city: "Bright Grove" },
  { name: "Brockville Little League", website: null, address: "73 Millwood Ave", city: "Brockville" },
  { name: "Burlington Organized Minor Baseball Association", website: null, address: "2315 Headon Forest Drive", city: "Burlington" },
  { name: "Byron Optimist Minor Baseball Association", website: null, address: "Byron Optimist Sports Complex", city: "Byron" },
  { name: "Bytown Dodgers Baseball Club", website: "https://bytowndodgers.ca/", address: null, city: "Ottawa" },
  { name: "Caledonia Minor Baseball", website: "www.caledoniabaseball.ca", address: "15, 123 Greens Rd", city: "Caledonia" },
  { name: "Cambridge Minor Baseball Association", website: null, address: "261 Hespeler Road", city: "Cambridge" },
  { name: "Camlachie Athletic Association", website: "camlachieathleticassociation.ca", address: "6767 Camlachie Road", city: "Cambridge" },
  { name: "Canadian Girls Baseball - Toronto Girls", website: null, address: "443 Arlington Ave", city: "Toronto" },
  { name: "Chatham Minor Baseball Association", website: null, address: "30 Tweedsmuir Ave W", city: "Chatham" },
  { name: "City of Vaughan Baseball & Softball Association", website: null, address: "7401 Martin Grove Rd", city: "Vaughan" },
  { name: "Clarington Minor Baseball Association", website: null, address: "26 Beech Ave, Bowmanville", city: "Clarington" },
  { name: "Clinton Minor Baseball", website: null, address: null, city: "Clinton" },
  { name: "Collingwood Minor Baseball Association", website: null, address: "11 High St", city: "Collingwood" },
  { name: "Cornwall Minor Baseball", website: null, address: "2 Bergeron Dr", city: "Cornwall" },
  { name: "Corunna Minor Baseball", website: null, address: "420 Colborne St", city: "Corunna" },
  { name: "Cottam Minor Baseball Association", website: null, address: "Ridgeview Park", city: "Cottam" },
  { name: "Courtright Minor Baseball", website: null, address: "1594 Third St.", city: "Courtright" },
  { name: "Delaware Komoka Mt. Brydges Minor Baseball", website: null, address: "29 Young St", city: "Delaware/Mt. Brydges" },
  { name: "Delhi Minor Baseball", website: null, address: "144 Western Ave", city: "Delhi" },
  { name: "Dorchester Baseball", website: null, address: "2066 Dorchester Rd", city: "London" },
  { name: "Dover Centre Baseball Association", website: null, address: "25986 baldoon Rd", city: "Dover Centre" },
  { name: "Dresden Minor Baseball", website: null, address: "207-303 Sydenham St", city: "Dresden" },
  { name: "Dundas Little League", website: null, address: "Volunteer Field", city: "Dundas" },
  { name: "Dundas Minor Baseball", website: null, address: "Volunteer Field", city: "Dundas" },
  { name: "Eager Beaver Baseball Association", website: null, address: "652 Elizabeth St", city: "London" },
  { name: "East Mountain Baseball Association", website: null, address: "1100 Mohawk Rd E", city: "Hamilton" },
  { name: "East Nepean Little League", website: null, address: "140 Meadowlands Drive West", city: "Ottawa" },
  { name: "East Toronto Baseball Association", website: null, address: "64 Ted Reeve Dr", city: "Toronto" },
  { name: "East York Baseball Association", website: null, address: "373 Cedarvale Avenue, East York, Toronto", city: "York" },
  { name: "Erindale Cardinals Baseball", website: null, address: "PO Box 43005 Mavis Road", city: "Mississauga" },
  { name: "Erindale Lions Little League", website: null, address: "3325 The Credit Woodlands", city: "Mississauga" },
  { name: "Essex Minor Baseball Association", website: null, address: "Ridgeview Park", city: "Essex" },
  { name: "Etobicoke Baseball Association", website: null, address: "281 Rimilton Ave", city: "Etobicoke" },
  { name: "Everett Baseball Association", website: "https://everettbaseball.ca/contacts/", address: "8186 Main Street", city: "Everett" },
  { name: "Exeter Minor Baseball", website: null, address: "210 Wellington St W", city: "Exeter" },
  { name: "Flesherton Minor Baseball", website: null, address: "101 Highland Drive", city: "Flesherton" },
  { name: "Forest Glen Baseball", website: null, address: "3614 Stonecreek Cres.", city: "Mississauga" },
  { name: "Forest Minor Baseball", website: null, address: "6276 Townsend Line", city: "Forest" },
  { name: "Fort Erie Minor Baseball Association", website: null, address: "393 Central Ave", city: "Fort Erie" },
  { name: "Georgina Minor Baseball Association", website: null, address: "26479 Civic Centre Rd", city: "Georgina" },
  { name: "Glebe Little League", website: null, address: "135 Dunbarton Ct", city: "Ottawa" },
  { name: "Goderich Minor Baseball", website: null, address: "180 McDonald St", city: "Goderich" },
  { name: "Grand Bend", website: null, address: null, city: "Grand Bend" },
  { name: "Greater Niagara Baseball Association", website: null, address: "5610 Arthur St", city: "Niagara" },
  { name: "Greensville Minor Baseball", website: null, address: "33 Webster Street", city: "Hamilton" },
  { name: "Grimsby Baseball League", website: null, address: "104 - 155 Main Street East, Suite 101", city: "Grimsby" },
  { name: "Guelph Minor Baseball Association", website: null, address: "100 Crimea St #5C", city: "Guelph" },
  { name: "Haldimand County Six Nations", website: null, address: "82 Kinross St", city: "Caledonia" },
  { name: "Halton Hills Minor Baseball", website: null, address: "1 Park Ave", city: "Halton Hills" },
  { name: "Hamilton District Baseball Association", website: "www.hdba.ca", address: "169 West 24th St.", city: "Hamilton" },
  { name: "Hanover Minor Baseball Association", website: null, address: "220 17th Ave", city: "Hanover" },
  { name: "Harrow Minor Baseball", website: null, address: "321 Walnut St S", city: "Harrow" },
  { name: "High Park Little League", website: null, address: "300 Colborne Lodge Dr", city: "Toronto" },
  { name: "Howick Minor Baseball", website: null, address: null, city: "Howick" },
  { name: "Ingersoll Minor Baseball", website: null, address: "4-30 Caffyn St", city: "Ingersoll" },
  { name: "Innisfil Minor Baseball Association", website: null, address: "Belle Ewart Innisfil, Ontario Box 4433", city: "Innisfil" },
  { name: "Ivy Minor Baseball Association", website: null, address: "246 Barrie St", city: "Ivy" },
  { name: "Kanata Baseball Association", website: null, address: "24056 Hazeldean RPO", city: "Kanata" },
  { name: "Kawartha Cubs Minor Baseball", website: null, address: "66 Cook St", city: "Lindsay" },
  { name: "Kendal Minor Baseball", website: null, address: "6742 Newtonville Rd, Orono", city: "Kendal" },
  { name: "Kincardine Minor Baseball", website: null, address: "151 Broadway St", city: "Kincardine" },
  { name: "Kingston Baseball Association", website: null, address: "2400 Perth Rd, Glenburnie", city: "Kingston" },
  { name: "Kingston Thunder Baseball Association", website: null, address: "1180 Woodbine Rd", city: "Kingston" },
  { name: "Kingsville Minor Baseball Association", website: null, address: "1741 Jasperson Rd", city: "Kingsville" },
  { name: "Kitchener Minor Baseball Association", website: null, address: "26 Elm St", city: "Kitchener" },
  { name: "Lakeshore Minor Baseball Association", website: "https://www.lakeshoreminorbaseball.ca", address: null, city: "Belle River" },
  { name: "Leamington Minor Baseball", website: null, address: "Carolina Woods Crescent", city: "Leamington" },
  { name: "Leaside Baseball Association", website: null, address: "#304-490 Eglinton Ave. East", city: "Leaside" },
  { name: "Lisle Astros Baseball Club", website: null, address: "P.O. Box 10", city: "York" },
  { name: "Listowel Minor Baseball", website: null, address: null, city: "Listowel" },
  { name: "London Badgers Baseball Association", website: null, address: null, city: "London" },
  { name: "London District Baseball Association", website: null, address: "1221 Sandford St", city: "London" },
  { name: "London Tecumsehs Baseball Club", website: null, address: "1221 Sandford St", city: "London" },
  { name: "London West Tincaps", website: null, address: "14 Ranson Drive", city: "London" },
  { name: "Lucan-Ilderton Baseball", website: "www.ildertonbaseball.com", address: "263 Main St", city: "Lucan" },
  { name: "Mahoney Baseball", website: null, address: "1655 Barton Street East", city: "Hamilton" },
  { name: "Mansfield Minor Baseball", website: null, address: null, city: "Mansfield" },
  { name: "Markham District Baseball Association", website: null, address: "5762 Hwy 7 East, PO Box 54014", city: "Markham" },
  { name: "Martingrove Baseball", website: null, address: "250 Wincott Drive", city: "Toronto" },
  { name: "Merritton", website: null, address: "5 Park Ave, St. Catharines", city: "Merritton" },
  { name: "Midland Penetang Baseball Association", website: null, address: "606 Little Lake Park Rd", city: "Midland" },
  { name: "Milton Minor Baseball Association", website: null, address: "670 Bennett Blvd", city: "Milton" },
  { name: "Mississauga Majors Baseball Association", website: null, address: null, city: "Mississauga" },
  { name: "Mississauga North Baseball Association", website: null, address: "6581 Kitimat Road, Units 5-6", city: "Mississauga" },
  { name: "Mississauga Southwest Baseball Association", website: null, address: "3195 The Collegeway", city: "Mississauga" },
  { name: "Mitchell Minor Ball", website: null, address: "185 Wellington St", city: "Mitchell" },
  { name: "Mount Forest Minor Baseball", website: null, address: null, city: "Mount Forest" },
  { name: "Muskoka Hornets Baseball Association", website: null, address: "2562 Brunel Road", city: "Huntsville" },
  { name: "New Lowell Minor Baseball", website: "www.nlmba.com", address: "11 Lamers Road", city: "New Lowell" },
  { name: "Newmarket Baseball Association", website: null, address: "800 Mulock Dr", city: "Newmarket" },
  { name: "Norfolk Senators Minor Baseball Association", website: null, address: "5-9 Allan St", city: "Walsingham" },
  { name: "North Bay Baseball Association", website: "info@northbaybaseball.ca", address: "720 Golf Club Road", city: "North Bay" },
  { name: "North London Baseball Association", website: null, address: "1593 Adelaide St. N", city: "London" },
  { name: "North Middlesex", website: null, address: null, city: "North Middlesex" },
  { name: "North Toronto Baseball Association", website: null, address: "2708 Yonge St", city: "Toronto" },
  { name: "North York Baseball Association", website: "www.nyba.ca", address: "Bond Park, 120 Bond Road", city: "North York" },
  { name: "Northumberland Baseball Association", website: null, address: "200 Maher Street", city: "Cobourg" },
  { name: "Oakridge Optimist Baseball Association", website: null, address: "651 Boler Rd", city: "London" },
  { name: "Oakville Little League", website: null, address: "425 Cornwall Road", city: "Oakville" },
  { name: "Oakville Minor Baseball", website: null, address: "2270 Speers Road", city: "Oakville" },
  { name: "Orangeville & Headwaters Minor Baseball Association", website: null, address: "8-229 Broadway, Suite 127, Orangeville, ON, L9W 1K4", city: "Orangeville" },
  { name: "Orillia Legion Minor Baseball", website: null, address: "3-200 Memorial Ave, Suite 335", city: "Orillia" },
  { name: "Orleans Coyotes Baseball Club", website: null, address: "6601 Carrière St, Orléans, ON K1C 4T6", city: "Ottawa" },
  { name: "Orleans Little League Baseball", website: null, address: "6595 Des Chouettes Lane, Orleans", city: "Ottawa" },
  { name: "Oshawa Legionaires Minor Baseball", website: null, address: "1274 Tallpine Avenue, L1K 0G3", city: "Oshawa" },
  { name: "Ottawa City Baseball Association", website: null, address: "Range Road", city: "Ottawa" },
  { name: "Ottawa Girls Baseball", website: null, address: "2240 Torquay Ave", city: "Ottawa" },
  { name: "Ottawa Valley Expos", website: null, address: null, city: "Braeside" },
  { name: "Ottawa Whisky Jacks", website: null, address: "1169 Cameo Dr", city: "Ottawa" },
  { name: "Owen Sound Minor Baseball Association", website: null, address: "1750 8th Ave W", city: "Owen Sound" },
  { name: "Pelham Minor Baseball Association", website: null, address: "P.O. Box 512", city: "Fonthill" },
  { name: "Peterborough Baseball Association", website: "peterboroughbaseball.ca", address: "PO Box 40014 Charlotte", city: "Peterborough" },
  { name: "Pickering Baseball Association", website: null, address: "P.O. Box 301", city: "Pickering" },
  { name: "Port Arthur Nationals", website: null, address: null, city: "Port Arthur" },
  { name: "Port Colborne Minor Baseball Association", website: null, address: "208 Clarence St", city: "Port Colborne" },
  { name: "Port Dover Minor Baseball", website: null, address: "954 George Street", city: "Port Dover" },
  { name: "Port Hope & District Minor Ball Association", website: null, address: "62 McCaul St", city: "Port Hope" },
  { name: "Port Lambton Pirates", website: null, address: "Hill St", city: "Port Lambton" },
  { name: "Prince Edward County Minor Baseball Association", website: null, address: "110 Belleville St, Belleville", city: "Prince Edward County" },
  { name: "Quinte Royals Baseball Association", website: "quinteroyalsbaseball.com", address: null, city: "Quinte" },
  { name: "Quinte West Amateur Baseball Association", website: "quintewestbaseball.ca", address: null, city: "Quinte" },
  { name: "Red Lake Minor Ball", website: null, address: "137 Howey Street", city: "Red Lake" },
  { name: "Rexdale Baseball League", website: null, address: "61 Hadrian Drive", city: "Rexdale" },
  { name: "Richmond Hill Phoenix Baseball Club", website: null, address: "Bayview 16th Ave", city: "Richmond Hill" },
  { name: "Ripley Minor Baseball", website: null, address: null, city: "Ripley" },
  { name: "Riverside Minor Baseball Association", website: null, address: "6865 Ontario St", city: "Riverside" },
  { name: "Royal York Minor Baseball", website: null, address: "3216 Bloor St W", city: "York" },
  { name: "Sarnia Brigade Minor Baseball Association", website: "www.sarniabrigade.ca", address: null, city: "Sarnia" },
  { name: "Saugeen Shores Minor Baseball", website: null, address: "649 Mill Creek Rd", city: "Saugeen Shores" },
  { name: "Scarborough Baseball Association", website: null, address: "1555 Neilson Rd", city: "Scarborough" },
  { name: "Seaway Surge Baseball Club", website: null, address: "18 Regiment Road", city: "Kemptville" },
  { name: "Simcoe Minor Baseball Association", website: null, address: "75 Davis St E", city: "Simcoe" },
  { name: "Soo Minor Baseball Association", website: null, address: "Black Rd", city: "Sault Ste. Marie" },
  { name: "South Bend Baseball Association", website: null, address: null, city: "South Bend" },
  { name: "South London Baseball Association Inc.", website: null, address: "1510 Commissioners Road E", city: "London" },
  { name: "South Ottawa Little League", website: null, address: "92 Malhotra Court", city: "Ottawa" },
  { name: "Southwest London Youth Baseball", website: null, address: "3970 Meadowbrook Dr", city: "London" },
  { name: "St. Catharines Minor Baseball Association", website: null, address: "P.O. Box 20273", city: "St. Catharines" },
  { name: "St. Marys Minor Ball", website: null, address: "386 Church St S", city: "St. Marys" },
  { name: "St. Thomas Minor Baseball", website: null, address: "204 First Avenue", city: "St. Thomas" },
  { name: "Stayner Minor Baseball Association", website: null, address: "4 Park Rd", city: "Angus" },
  { name: "Stoney Creek Little League", website: null, address: "890 Queenston Rd", city: "Stoney Creek" },
  { name: "Stouffville Baseball Association", website: null, address: "12483 Ninth Line, Stouffville L4A 1C2", city: "Stouffville" },
  { name: "Stratford Minor Baseball", website: null, address: null, city: "Stratford" },
  { name: "Strathclair Minor Ball", website: null, address: "99 Foster Drive", city: "Strathclair" },
  { name: "Strathroy Minor Baseball", website: null, address: "230 York St", city: "Strathroy" },
  { name: "Sudbury Minor Baseball Association", website: "info@sudburyminorbaseball.com", address: "21 Lasalle Blvd", city: "Sudbury" },
  { name: "Tecumseh Minor Baseball Association", website: "info@tmba.ca", address: "12021 McNorton St", city: "Tecumseh" },
  { name: "Thamesford Minor Baseball", website: null, address: "221 George St", city: "Thamesford" },
  { name: "Thornhill Baseball Club", website: "https://thornhillbaseball.net/contact-us-email/", address: "298 John St", city: "Thornhill" },
  { name: "Thorold Minor Baseball", website: null, address: "30 Coleman Crt", city: "Thorold" },
  { name: "Tilbury Minor Baseball Association", website: null, address: "30 Tweedsmuir Ave W", city: "Tilbury" },
  { name: "Tillsonburg Minor Baseball", website: null, address: "128 Concession St E", city: "Tillsonburg" },
  { name: "Toronto Playgrounds Baseball", website: null, address: "485 Montrose Ave", city: "Toronto" },
  { name: "Tottenham Minor Baseball", website: null, address: "72 Prospect St", city: "Beeton" },
  { name: "Turtle Club Baseball and Softball", website: null, address: "370 Reaume Road", city: "Lasalle" },
  { name: "Uxbridge Youth Baseball Association", website: null, address: "PO Box 87", city: "Uxbridge" },
  { name: "Valley East Minor Baseball Association", website: null, address: "1045 Tilly Street", city: "Valley East" },
  { name: "Victoria - Brock Baseball Association", website: null, address: null, city: "Victoria-Brock" },
  { name: "Walker Homesites Athletic Club", website: null, address: null, city: "Walker Homesites" },
  { name: "Walkerton Minor Ball", website: null, address: "290 Durham St W", city: "Walkerton" },
  { name: "Wallaceburg Minor Baseball Association", website: null, address: "1 Robert St, Chatham-Kent, ON", city: "Wallaceburg" },
  { name: "Warkworth Minor Baseball", website: null, address: null, city: "Warkworth" },
  { name: "Wasaga Beach Minor Baseball Association", website: null, address: "P.O. Box 34", city: "Wasaga Beach" },
  { name: "Waterdown Minor Baseball Association", website: null, address: "101 Hollybush Dr", city: "Waterdown" },
  { name: "Waterloo Minor Baseball Association", website: null, address: "500 Parkside Drive", city: "Waterloo" },
  { name: "Welland Minor Baseball", website: null, address: "404 Memorial Park Dr", city: "Welland" },
  { name: "West Hill Baseball League", website: null, address: null, city: "Westhill" },
  { name: "West Mountain Baseball Association", website: "www.wmbacougars.com", address: "P.O. Box 60586 661 Upper James St.", city: "Hamilton" },
  { name: "West Niagara Minor Baseball", website: null, address: "84 Mud St W", city: "Niagara" },
  { name: "West Toronto Baseball", website: null, address: null, city: "West Toronto" },
  { name: "Weston Minor Baseball", website: null, address: null, city: "Weston" },
  { name: "Wexford-Agincourt Baseball League", website: null, address: null, city: "Scarborough" },
  { name: "Whitby Minor Baseball Association", website: null, address: "111 Industrial Dr", city: "Whitby" },
  { name: "Windsor", website: null, address: "4050 Matchette Rd", city: "Windsor" },
  { name: "Windsor Central Little League", website: null, address: "3739 Ypres Ave", city: "Windsor" },
  { name: "Windsor South Little League", website: null, address: "2500 Labelle St", city: "Windsor" },
  { name: "Woodslee Baseball Association", website: null, address: "1409-1473 Oriole Park Dr", city: "South Woodslee" },
  { name: "Woodstock Minor Baseball Association", website: null, address: "225 Main Street", city: "Woodstock" },
  { name: "Wyoming Minor Baseball Association", website: null, address: "571 Erie St", city: "Wyoming" },
  { name: "York", website: null, address: null, city: "York" },
];

async function seedOrganizations() {
  console.log("Starting OBA organization seeding...");
  console.log(`Total organizations to seed: ${obaOrganizations.length}`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const org of obaOrganizations) {
    const slug = generateSlug(org.name);
    
    try {
      await db.insert(organizations).values({
        name: org.name,
        slug: slug,
        websiteUrl: org.website ? (org.website.startsWith('http') ? org.website : `https://${org.website}`) : null,
        address: org.address,
        city: org.city,
        isClaimed: false,
        claimToken: nanoid(32),
      }).onConflictDoNothing();
      
      inserted++;
      console.log(`✓ Inserted: ${org.name} (${slug})`);
    } catch (error: any) {
      if (error.code === '23505') {
        skipped++;
        console.log(`⏭ Skipped (duplicate): ${org.name}`);
      } else {
        console.error(`✗ Error inserting ${org.name}:`, error.message);
      }
    }
  }
  
  console.log(`\nSeeding complete!`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped: ${skipped}`);
  
  process.exit(0);
}

seedOrganizations().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
