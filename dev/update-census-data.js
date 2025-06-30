#!/usr/bin/env node

/**
 * Census Data Updater
 *
 * This script fetches data from Google Sheets and updates the census-data.json file.
 * Can be run manually or scheduled with cron jobs.
 *
 * Usage:
 *   node update-census-data.js
 *
 * Environment variables:
 *   GOOGLE_SHEETS_URL - The Google Sheets URL to fetch from
 *   OUTPUT_FILE - Path to the output JSON file (default: census-data.json)
 */

const fs = require("fs").promises;
const path = require("path");

// Configuration
const GOOGLE_SHEETS_URL =
  process.env.GOOGLE_SHEETS_URL ||
  "https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/gviz/tq?tqx=out:csv&gid=1977273024";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "census-data.json";

/**
 * Parse CSV data from Google Sheets
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.replace(/"/g, "").trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header.toLowerCase()] = values[index] || "";
      });

      // Extract interest name and total players
      const interestName = row["games / interests"] || row["interest"] || "";
      const totalPlayers = parseInt(row["total players"]) || 0;

      // Count individual members who have this interest (marked with "1")
      let memberCount = 0;
      const memberColumns = headers.filter(
        (h) =>
          h !== "games / interests" &&
          h !== "interest" &&
          h !== "total players" &&
          h.trim() !== "",
      );

      memberColumns.forEach((memberCol) => {
        const memberValue = row[memberCol.toLowerCase()];
        if (memberValue === "1" || memberValue === "1.0") {
          memberCount++;
        }
      });

      // Use the higher count between total players and actual member count
      const finalCount = Math.max(totalPlayers, memberCount);

      return {
        interest: interestName,
        category: getInterestCategory(interestName),
        members: finalCount,
        description: getInterestDescription(interestName),
      };
    })
    .filter(
      (row) =>
        row.interest &&
        row.interest !== "" &&
        row.interest !== "Games / Interests",
    );
}

/**
 * Categorize interests
 */
function getInterestCategory(interestName) {
  const gamingKeywords = [
    "minecraft",
    "terraria",
    "gta",
    "counter-strike",
    "overwatch",
    "rocket league",
    "valorant",
    "roblox",
    "bloons",
    "geometry dash",
    "risk",
    "apex",
    "stardew",
    "halo",
    "tf",
    "space engineers",
    "hypixel",
    "geoguessr",
    "scp",
    "risk of rain",
    "chess",
    "destiny",
    "battlefield",
    "fortnite",
    "call of duty",
    "borderlands",
    "ark",
    "runescape",
  ];
  const techKeywords = [
    "development",
    "programming",
    "coding",
    "software",
    "web",
    "server",
    "admin",
  ];
  const creativeKeywords = [
    "anime",
    "art",
    "music",
    "writing",
    "photography",
    "3d",
    "modeling",
    "design",
  ];

  const lowerInterest = interestName.toLowerCase();

  if (gamingKeywords.some((keyword) => lowerInterest.includes(keyword))) {
    return "Gaming";
  } else if (techKeywords.some((keyword) => lowerInterest.includes(keyword))) {
    return "Technology";
  } else if (
    creativeKeywords.some((keyword) => lowerInterest.includes(keyword))
  ) {
    return "Creative";
  } else {
    return "Other";
  }
}

/**
 * Generate descriptions for interests
 */
function getInterestDescription(interestName) {
  const descriptions = {
    "Among Us":
      "Social deduction game where players work together to identify impostors",
    Terraria:
      "2D sandbox adventure game with building, combat, and exploration",
    "GTA V / FiveM": "Open-world action game with roleplay servers",
    "Counter-Strike: Global Offensive":
      "Competitive tactical first-person shooter",
    "Survival MC": "Minecraft survival multiplayer with economy and community",
    "Tom Clancy's Rainbow Six: Siege":
      "Tactical team-based shooter with destructible environments",
    "Creative MC": "Minecraft creative mode for building and design",
    Overwatch: "Team-based hero shooter with diverse characters",
    "Rocket League": "Soccer with rocket-powered cars",
    Anime: "Japanese animation and manga culture",
    Valorant: "Tactical hero shooter with unique abilities",
    "Development / Programming": "Software development and coding projects",
    "Garry's Mod": "Sandbox physics game with extensive modding",
    "League of Legends": "Multiplayer online battle arena (MOBA)",
    Unturned: "Zombie survival game with crafting and base building",
    Roblox: "Game creation platform and social gaming",
    "Bloons TD6": "Tower defense strategy game",
    "Rubik's Cube": "Puzzle solving and speedcubing",
    "Geometry Dash": "Rhythm-based action platformer",
    "Risk (Global Domination)": "Strategic board game of world conquest",
    "Apex Legends": "Battle royale hero shooter",
    "Stardew Valley": "Farming simulation and life simulation game",
    "Halo Master Chief": "Sci-fi first-person shooter series",
    "TF 2": "Team Fortress 2 - class-based multiplayer shooter",
    "Space Engineers": "Space simulation with building and survival",
    Hypixel: "Popular Minecraft mini-games server",
    Geoguessr: "Geography-based puzzle game",
    SCP: "Horror fiction and gaming community",
    "Counter-Strike: Source": "Classic tactical shooter",
    "Risk of Rain 2": "Roguelike third-person shooter",
    Chess: "Strategic board game",
    "Destiny 2": "Online multiplayer first-person shooter",
    "Battlefield 4": "Military first-person shooter",
    Fortnite: "Battle royale game with building mechanics",
    "Call of Duty": "Military first-person shooter series",
    "Borderlands 2": "Looter shooter with RPG elements",
    "Ark Survival: Evolved": "Dinosaur survival game",
    Runescape: "MMORPG with fantasy setting",
  };

  return descriptions[interestName] || `Community interest in ${interestName}`;
}

/**
 * Main function to update census data
 */
async function updateCensusData() {
  try {
    console.log("🔄 Starting census data update...");
    console.log(`📊 Fetching data from: ${GOOGLE_SHEETS_URL}`);

    // Fetch data from Google Sheets
    const response = await fetch(GOOGLE_SHEETS_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from Google Sheets: ${response.status} ${response.statusText}`,
      );
    }

    const csvText = await response.text();
    console.log(`📄 Received CSV data (${csvText.length} characters)`);

    // Parse the CSV data
    const interestsData = parseCSV(csvText);
    console.log(`✅ Parsed ${interestsData.length} interests`);

    // Create the output object
    const outputData = {
      lastUpdated: new Date().toISOString(),
      data: interestsData,
    };

    // Write to JSON file
    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(outputData, null, 2),
      "utf8",
    );
    console.log(
      `💾 Updated ${OUTPUT_FILE} with ${interestsData.length} interests`,
    );
    console.log(`🕒 Last updated: ${outputData.lastUpdated}`);

    return true;
  } catch (error) {
    console.error("❌ Error updating census data:", error.message);
    return false;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateCensusData()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}

module.exports = {
  updateCensusData,
  parseCSV,
  getInterestCategory,
  getInterestDescription,
};
