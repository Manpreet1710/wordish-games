/**
 * Wordora Answer List
 * 
 * A curated, deterministic sequence of 5-letter words used as daily answers.
 * Rules:
 * - Exactly 5 alphabetic letters each
 * - No offensive or misleading words
 * - No proper nouns
 * - Normalized to UPPERCASE
 * - No duplicates
 * 
 * Epoch date: 2026-10-21 UTC (puzzle #1)
 * Each subsequent calendar day increments the puzzle number.
 * 
 * This is the POOL of words the daily scheduler picks from. The actual answer
 * for each day is assigned ahead of time and stored in MongoDB (`puzzles`),
 * see functions/_shared/puzzles.js. Never-used words are picked first.
 * 
 * To add answers: append words to the END of this array.
 * Adding words never changes past, current or already-scheduled puzzles.
 * Do NOT remove or reorder words: the legacy fallback formula depends on order.
 * To validate: run `npm run validate-words`
 */

const ANSWERS = [
  // Puzzle #1 onwards (starting 2026-10-21 UTC)
  "ABOUT", "ABOVE", "ABUSE", "ACTOR", "ACUTE", "ADMIT", "ADOPT", "ADULT",
  "AFTER", "AGAIN", "AGENT", "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT",
  "ALIKE", "ALIGN", "ALIVE", "ALLEY", "ALLOW", "ALONE", "ALONG", "ALTER",
  "ANGEL", "ANGER", "ANGLE", "ANGRY", "ANIME", "ANKLE", "ANNEX", "APART",
  "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE", "ARMOR", "ARSON", "ASSET",
  "ATLAS", "ATTIC", "AUDIO", "AUDIT", "AVOID", "AWAIT", "AWAKE", "AWARD",
  "AWARE", "AWFUL", "BADLY", "BAKER", "BASES", "BASIC", "BASIS", "BEACH",
  "BEGIN", "BEING", "BELOW", "BENCH", "BILLY", "BIRTH", "BLACK", "BLADE",
  "BLAME", "BLAND", "BLANK", "BLAST", "BLAZE", "BLEED", "BLEND", "BLESS",
  "BLIND", "BLOCK", "BLOOD", "BLOOM", "BLOWN", "BLUES", "BLUNT", "BOARD",
  "BONUS", "BOOST", "BOOTH", "BOUND", "BOXER", "BRAIN", "BRAND", "BRAVE",
  "BREAD", "BREAK", "BREED", "BRIBE", "BRICK", "BRIDE", "BRIEF", "BRING",
  "BRISK", "BROAD", "BROKE", "BROOK", "BROOM", "BROWN", "BRUSH", "BUDDY",
  "BUILD", "BUILT", "BULGE", "BUNCH", "BURST", "BUYER", "CABIN", "CABLE",
  "CANDY", "CARRY", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHAOS", "CHARM",
  "CHART", "CHASE", "CHEAP", "CHECK", "CHEEK", "CHEER", "CHESS", "CHEST",
  "CHIEF", "CHILD", "CHILL", "CHOIR", "CHUNK", "CIVIC", "CIVIL", "CLAIM",
  "CLASS", "CLEAN", "CLEAR", "CLERK", "CLICK", "CLIFF", "CLIMB", "CLING",
  "CLOCK", "CLOSE", "CLOTH", "CLOUD", "CLOWN", "COACH", "COAST", "COLOR",
  "COMIC", "COMMA", "CORAL", "COUCH", "COULD", "COUNT", "COURT", "COVER",
  "CRAFT", "CRASH", "CRAZY", "CREAM", "CREEK", "CRIME", "CRISP", "CROSS",
  "CROWD", "CROWN", "CRUSH", "CURVE", "CYBER", "DAILY", "DANCE", "DEALT",
  "DEATH", "DEBUT", "DECAY", "DELAY", "DELTA", "DENSE", "DEPOT", "DEPTH",
  "DERBY", "DIARY", "DIGIT", "DIRTY", "DISCO", "DIVER", "DIZZY", "DODGE",
  "DOING", "DONOR", "DOUBT", "DOUGH", "DRAFT", "DRAIN", "DRAMA", "DRANK",
  "DRAWN", "DREAM", "DRESS", "DRIFT", "DRINK", "DRIVE", "DROVE", "DROWN",
  "DRUNK", "DRYER", "DUSTY", "EAGER", "EARLY", "EARTH", "EIGHT", "ELITE",
  "EMAIL", "EMBER", "EMOTE", "EMPTY", "ENEMY", "ENJOY", "ENTER", "ENTRY",
  "EQUAL", "ERROR", "EVENT", "EVERY", "EXACT", "EXCEL", "EXIST", "EXTRA",
  "FABLE", "FACED", "FAITH", "FALSE", "FANCY", "FATAL", "FAULT", "FEAST",
  "FENCE", "FERRY", "FETCH", "FEVER", "FEWER", "FIBER", "FIELD", "FIFTH",
  "FIFTY", "FIGHT", "FINAL", "FIRST", "FIXED", "FLAME", "FLASH", "FLASK",
  "FLEET", "FLESH", "FLOAT", "FLOOD", "FLOOR", "FLOUR", "FLUID", "FLUTE",
  "FOCAL", "FOGGY", "FORCE", "FORGE", "FORTH", "FORUM", "FOUND", "FRAME",
  "FRANK", "FRAUD", "FRESH", "FRONT", "FROZE", "FRUIT", "FULLY", "FUNGI",
  "FUNNY", "GENRE", "GHOST", "GIANT", "GIVEN", "GLADE", "GLAND", "GLASS",
  "GLEAM", "GLIDE", "GLOOM", "GLOVE", "GOING", "GRACE", "GRADE", "GRAIN",
  "GRAND", "GRANT", "GRASP", "GRASS", "GRAVE", "GREAT", "GREED", "GREEN",
  "GREET", "GRIEF", "GRILL", "GRIMY", "GROAN", "GROIN", "GROOM", "GROSS",
  "GROUP", "GROVE", "GROWL", "GUARD", "GUIDE", "GUILE", "GUILD", "GUISE",
  "GULCH", "GUSTO", "HAPPY", "HARSH", "HASTE", "HAVEN", "HEARD", "HEART",
  "HEAVY", "HENCE", "HERBS", "HINGE", "HIPPO", "HOIST", "HONEY", "HONOR",
  "HORSE", "HOTEL", "HOUSE", "HUMAN", "HUMOR", "HURRY", "HYPER", "IDEAL",
  "IMAGE", "IMPLY", "INDEX", "INDIE", "INFER", "INPUT", "INTER", "INTRO",
  "IONIC", "IRONY", "ISSUE", "IVORY", "JEWEL", "JOINT", "JOKER", "JUDGE",
  "JUICE", "JUICY", "KARMA", "KAYAK", "KNEEL", "KNIFE", "KNOCK", "KNOWN",
  "LABEL", "LAPSE", "LARGE", "LASER", "LATER", "LAUGH", "LAYER", "LEAFY",
  "LEARN", "LEASE", "LEAST", "LEAVE", "LEGAL", "LEMON", "LEVEL", "LIGHT",
  "LIMIT", "LINEN", "LIVER", "LOCAL", "LODGE", "LOGIC", "LOOSE", "LOUSY",
  "LOVER", "LOWER", "LUCKY", "LUNCH", "LYMPH", "LYRIC", "MAGIC", "MAJOR",
  "MAKER", "MANOR", "MARCH", "MARSH", "MATCH", "MAYOR", "MEDIA", "MERCY",
  "MERIT", "MERRY", "METAL", "MIGHT", "MILLS", "MINOR", "MINUS", "MIRTH",
  "MODEL", "MONEY", "MONTH", "MORAL", "MOTIF", "MOTOR", "MOUNT", "MOUSE",
  "MOUTH", "MOVED", "MOVIE", "MUDDY", "MUSIC", "NAIVE", "NANNY", "NERVE",
  "NEVER", "NIGHT", "NOBLE", "NOISE", "NORTH", "NOTED", "NOVEL", "NURSE",
  "NYMPH", "OCEAN", "OFFER", "OFTEN", "OLIVE", "ONSET", "OPERA", "ORBIT",
  "ORDER", "OTHER", "OUGHT", "OUTER", "OXIDE", "OZONE", "PAINT", "PANEL",
  "PANIC", "PAPER", "PARTY", "PATCH", "PAUSE", "PEACE", "PEACH", "PEARL",
  "PEDAL", "PENNY", "PERCH", "PILOT", "PIXEL", "PIZZA", "PLACE", "PLAIN",
  "PLANE", "PLANT", "PLATE", "PLAZA", "PLEAD", "PLUMB", "PLUME", "PLUMP",
  "PLUNK", "POINT", "POLAR", "POWER", "PRESS", "PRICE", "PRIDE", "PRIME",
  "PRINT", "PRIOR", "PRIZE", "PROBE", "PRONE", "PROOF", "PROSE", "PROUD",
  "PROVE", "PRUNE", "PSALM", "PULSE", "PUPIL", "PURSE", "QUEEN", "QUEST",
  "QUEUE", "QUICK", "QUIET", "QUOTA", "QUOTE", "RADIO", "RAISE", "RALLY",
  "RANCH", "RANGE", "RAPID", "RATIO", "REACH", "READY", "REALM", "REBEL",
  "REBUS", "RECON", "REFER", "REIGN", "RELAY", "REPAY", "REPEL", "REPLY",
  "RERUN", "REVEL", "RIDER", "RIDGE", "RISKY", "RIVAL", "RIVER", "ROBOT",
  "ROCKY", "ROMAN", "ROGUE", "ROUGH", "ROUND", "ROUTE", "ROYAL", "RULER",
  "SADLY", "SAINT", "SAUCE", "SCALE", "SCARE", "SCENE", "SCOPE", "SCORE",
  "SCOUT", "SCOWL", "SEIZE", "SENSE", "SERVE", "SETUP", "SEVEN", "SHADE",
  "SHAKE", "SHALL", "SHAME", "SHAPE", "SHARE", "SHARK", "SHARP", "SHEEP",
  "SHEER", "SHELF", "SHELL", "SHIFT", "SHINE", "SHIRT", "SHOCK", "SHOOT",
  "SHORT", "SHOUT", "SHOWN", "SIGHT", "SILLY", "SINCE", "SKILL", "SKIRT",
  "SKULL", "SLATE", "SLAVE", "SLEEP", "SLEEK", "SLIDE", "SLOPE", "SMART",
  "SMILE", "SMOKE", "SNAKE", "SOLAR", "SOLVE", "SORRY", "SOUTH", "SPACE",
  "SPADE", "SPARE", "SPARK", "SPEAK", "SPEAR", "SPEED", "SPEND", "SPICE",
  "SPINE", "SPITE", "SPLIT", "SPOKE", "SPOON", "SPORT", "SQUAD", "STACK",
  "STAFF", "STAGE", "STAIN", "STAIR", "STAKE", "STALE", "STALK", "STAMP",
  "STAND", "STARE", "START", "STASH", "STATE", "STAVE", "STEAL", "STEAM",
  "STEEL", "STEEP", "STEER", "STERN", "STICK", "STIFF", "STILL", "STING",
  "STOCK", "STOIC", "STONE", "STOOD", "STORM", "STORY", "STOUT", "STRAW",
  "STRIP", "STUCK", "STUDY", "STYLE", "SUGAR", "SUITE", "SUNNY", "SUPER",
  "SURGE", "SWAMP", "SWEAR", "SWEEP", "SWEET", "SWEPT", "SWIFT", "SWIRL",
  "TABLE", "TAKEN", "TASTE", "TEACH", "TEETH", "TENSE", "TERMS", "THANK",
  "THEFT", "THEIR", "THEME", "THERE", "THICK", "THING", "THINK", "THIRD",
  "THORN", "THOSE", "THREE", "THREW", "THROW", "TIGER", "TIMER", "TIRED",
  "TITLE", "TODAY", "TOKEN", "TOTAL", "TOUCH", "TOUGH", "TOWEL", "TOWER",
  "TOXIC", "TRACE", "TRACK", "TRADE", "TRAIL", "TRAIN", "TRAMP", "TRASH",
  "TREAT", "TREND", "TRIAL", "TRIBE", "TRICK", "TRIED", "TROOP", "TRUCK",
  "TRULY", "TRUMP", "TRUST", "TRUTH", "TULIP", "TWICE", "TWIST", "TYING",
  "ULTRA", "UNCLE", "UNDER", "UNION", "UNITY", "UNTIL", "UPPER", "UPSET",
  "URBAN", "USAGE", "USUAL", "UTTER", "VALID", "VALOR", "VALUE", "VALVE",
  "VAPOR", "VAULT", "VERSE", "VIDEO", "VIGOR", "VIRAL", "VIRUS", "VISOR",
  "VISIT", "VITAL", "VIVID", "VOCAL", "VOICE", "VOTER", "WAGON", "WATER",
  "WEARY", "WEAVE", "WEDGE", "WEIRD", "WHALE", "WHEAT", "WHEEL", "WHERE",
  "WHILE", "WHITE", "WHOLE", "WHOSE", "WIDER", "WITCH", "WOMAN", "WOMEN",
  "WORLD", "WORRY", "WORST", "WORTH", "WOULD", "WOUND", "WRIST", "WRITE",
  "WRONG", "YIELD", "YOUNG", "YOURS", "YOUTH", "ZEBRA", "ZONAL"
];

// For Node.js (Netlify Functions / scripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ANSWERS };
}
