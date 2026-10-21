/**
 * Wordora Valid Guesses Dictionary
 * 
 * All accepted 5-letter words for guesses.
 * Includes the answer list plus additional common 5-letter words.
 * The getValidGuesses() function in _shared/words.js merges this with
 * all answers and filters to strictly 5-letter uppercase words.
 * 
 * Rules:
 * - Exactly 5 alphabetic letters
 * - Normalized to UPPERCASE
 * - No duplicates
 * - Includes all answers as valid guesses
 */

const VALID_GUESSES = new Set([
  // Extended guess dictionary — common 5-letter English words
  "AAHED", "ABACI", "ABACK", "ABASH", "ABATE", "ABBEY", "ABBOT", "ABHOR",
  "ABIDE", "ABLER", "ABODE", "ABORT", "ABUZZ", "ABYSS", "ACORN", "ACHED",
  "ACHES", "ACIDS", "ACTED", "ACTIN", "ADDED", "ADEPT", "ADIEU", "ADOBE",
  "AEONS", "AGAVE", "AGILE", "AGLOW", "AGONY", "AGORA", "AIDED", "AIMER",
  "AISLE", "ALGAE", "ALOFT", "ALPHA", "ALTAR", "ALLAY", "ALLOT", "AMAZE",
  "AMBER", "AMBLE", "AMEND", "AMISS", "AMONG", "AMPLE", "AMUSE", "ANNOY",
  "ANTIC", "ANVIL", "AORTA", "APRON", "APTLY", "ARBOR", "ARDOR", "AROMA",
  "AROSE", "ARSON", "ARTSY", "ASKEW", "ASHEN", "ASHES", "ASIDE", "ASSAY",
  "ATOLL", "ATONE", "AUGUR", "AVAIL", "AXIAL", "AZURE", "BAGEL", "BADGE",
  "BAKED", "BALES", "BALMY", "BANAL", "BARON", "BASIL", "BATCH", "BATHE",
  "BATTY", "BAYOU", "BEADY", "BEARD", "BEAST", "BEFIT", "BEIGE", "BELLE",
  "BELLY", "BERTH", "BEVEL", "BEZEL", "BIOME", "BIRCH", "BISON", "BLIMP",
  "BLISS", "BOXED", "BRAWL", "BRIBE", "BRIER", "BRINE", "BROTH", "BUDGE",
  "BURLY", "BURRO", "CACAO", "CACHE", "CADET", "CAMEL", "CAMEO", "CAROB",
  "CARVE", "CEDAR", "CHAFE", "CHALK", "CHAMP", "CHANT", "CHASM", "CHAFF",
  "CHIDE", "CHINA", "CHIMP", "CHIVE", "CHOKE", "CHOMP", "CHORD", "CHOSE",
  "CITED", "CLASP", "CLEAT", "CLEFT", "CLOMP", "CLUMP", "COBRA", "COCOA",
  "COLIC", "COLON", "COMET", "CONDO", "COPED", "COPSE", "CREEP", "CURED",
  "DAFFY", "DANDY", "DATED", "DETER", "DITTO", "DITTY", "DIVAN", "DOMED",
  "DOPEY", "DOTED", "DOWEL", "DOWNY", "DREAD", "DROOL", "DROOP", "DROSS",
  "DROVE", "DUPED", "EASEL", "EERIE", "EGRET", "ELBOW", "ELDER", "EMERY",
  "EPOXY", "ERUPT", "EXPEL", "FAMED", "FARED", "FARCE", "FIEND", "FIERY",
  "FILET", "FILLY", "FINCH", "FLANK", "FLAIR", "FLARE", "FLOWN", "FLUNK",
  "FOAMY", "FORAY", "FORTE", "FORGO", "FOXED", "FRAIL", "FREED", "FROND",
  "FROTH", "FROZE", "FUDGE", "GAUDY", "GAUZE", "GECKO", "GERMY", "GIBES",
  "GIDDY", "GIZMO", "GNASH", "GONER", "GORGE", "GOUGE", "GRAFT", "GRIME",
  "GRIPE", "GRUEL", "GRUFF", "GUAVA", "GUMMY", "GUSTY", "HADJI", "HAIKU",
  "HARDY", "HAZEL", "HEADY", "HEDGE", "HEFTY", "HIKED", "HIPPY", "HOARY",
  "HOLLY", "HOUND", "HOVER", "HUMID", "HUSKY", "HYENA", "ICING", "IDYLL",
  "IMPEL", "INANE", "INCUR", "INEPT", "INERT", "INKED", "INLET", "IRATE",
  "IRONS", "ITCHY", "JAUNT", "JAZZY", "JOLLY", "JOUST", "JUMBO", "JUMPY",
  "KHAKI", "KITTY", "KNACK", "KNAVE", "KNEEL", "KNELT", "LADLE", "LANKY",
  "LATCH", "LEAPT", "LEDGE", "LEERY", "LIEGE", "LINER", "LITHE", "LOBBY",
  "LOOPY", "LOFTY", "LOUSE", "LOYAL", "LUSTY", "MAGMA", "MANIA", "MAPLE",
  "MATEY", "MEALY", "MELEE", "MELON", "MISER", "MOCHA", "MOODY", "MORON",
  "MOSSY", "MOURN", "MUGGY", "MURKY", "MUTED", "MYRRH", "NIFTY", "NIPPY",
  "NITTY", "NUTTY", "NYMPH", "OCTET", "OFFAL", "ONION", "OPTIC", "OTTER",
  "OVOID", "PAGAN", "PARKA", "PASTE", "PATSY", "PAVED", "PENAL", "PETAL",
  "PETTY", "PHONY", "PHOTO", "PINCH", "PIXIE", "PLAID", "PLAIT", "PLANK",
  "PLAZA", "POACH", "POLKA", "POPPY", "PORKY", "POSER", "POTTY", "POUTY",
  "PRIVY", "PROXY", "PUDGY", "PUNKY", "PUSHY", "PYGMY", "QUAFF", "QUAIL",
  "QUALM", "QUASH", "RABID", "RAINY", "RASPY", "RATTY", "REBUT", "REEDY",
  "REGAL", "REMIT", "RETCH", "RETRY", "RHYME", "RIPEN", "RIVET", "ROOST",
  "ROWDY", "RUMMY", "RUNNY", "RUSTY", "SABER", "SALTY", "SALVE", "SANER",
  "SAPPY", "SAVVY", "SCALD", "SCALP", "SCANT", "SCAMP", "SEAMY", "SEDAN",
  "SEEDY", "SERUM", "SHADY", "SHAKY", "SHARD", "SHEEN", "SHRUB", "SHRUG",
  "SHUNT", "SIEGE", "SIGMA", "SLAIN", "SLANG", "SLASH", "SLICK", "SLIME",
  "SLING", "SLINK", "SLUMP", "SLUNG", "SLUNK", "SMACK", "SMEAR", "SMELL",
  "SMELT", "SMOCK", "SNACK", "SNAKY", "SNARE", "SNARL", "SNEAK", "SNEER",
  "SNIFF", "SNORT", "SNOUT", "SNOWY", "SOGGY", "SPANK", "SPAWN", "SPECK",
  "SPIEL", "SPILL", "SPINY", "SPIRE", "SPOOK", "SPORE", "SPUNK", "STAID",
  "STEAD", "STEED", "STEWS", "STIRK", "STOMP", "STOOP", "STRAY", "STREW",
  "STUNT", "SUAVE", "SULKY", "SURLY", "SWATH", "SWILL", "SWOON", "SWOOP",
  "TACKY", "TAFFY", "TALON", "TANGY", "TARDY", "TAUNT", "TAWNY", "TEMPT",
  "TEPID", "TERSE", "TIDAL", "TIMID", "TIPSY", "TONIC", "TOPAZ", "TROVE",
  "TRUCE", "TUBBY", "TUMMY", "TWAIN", "TWANG", "ULCER", "UMBER", "UNIFY",
  "VAUNT", "VEGAN", "VENAL", "VENUE", "VODKA", "VOMIT", "VOUCH", "WAGER",
  "WITTY", "WORMY", "YAHOO", "YEARN", "ZINGY", "ZIPPY",
  // Ensure all answers from answers.js are included (merged at runtime)
]);

// For Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VALID_GUESSES };
}
