import os
import re

IMSLP_WIKI_PREFIX = "https://imslp.org/wiki/"

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "cache")


# Known instrument / part names that appear at the end of IMSLP file titles.
# Includes common English, French, and German variants.
KNOWN_INSTRUMENTS = {
    # Common English names
    "Piano", "Organ", "Harpsichord", "Clavichord", "Celesta",
    "Violin", "Viola", "Cello", "Bass", "Contrabass", "Double Bass",
    "Flute", "Piccolo", "Oboe", "English Horn", "Cor Anglais",
    "Clarinet", "Bass Clarinet", "Bassoon", "Contrabassoon",
    "Horn", "HornF", "Trumpet", "Cornet", "Trombone", "Tuba",
    "Euphonium", "Baritone", "Saxophone", "Saxhorn",
    "Harp", "Guitar", "Mandolin", "Banjo", "Lute",
    "Timpani", "Percussion", "Drums", "Cymbals", "Triangle",
    "Soprano", "Mezzo", "Alto", "Tenor", "Baritone", "Bass",
    "Voice", "Choir", "Chorus",
    # French variants (common in IMSLP orchestral parts)
    "Violon", "Violoncelle", "Violon1", "Violon2",
    "Hautbois", "Hautbois1", "Hautbois2",
    "Clarinette", "Clarinette1", "Clarinette2",
    "Basson", "Basson1", "Basson2",
    "Cor", "Cor1", "Cor2", "Cor3", "Cor4",
    "Trompette", "Trompette1", "Trompette2",
    "Trombone1", "Trombone2", "Trombone3",
    "Timbales", "Timbales1",
    "Contrebasse", "Contrebasses", "Basses",
    "Flute1", "Flute2", "Flute3",
    "Piccolo1", "Piccolo2",
    # German variants
    "Violine", "Bratsche", "Violoncell", "Kontrabass",
    "Flote", "Oboe", "Klarinette", "Fagott",
    "Horn", "Trompete", "Posaune", "Tuba",
    "Pauken",
    # Other common IMSLP labels
    "Score", "Part", "Parts", "Full Score", "Miniature Score",
    "Vocal Score", "Piano Score",
    # Misc
    "Cello1", "Cello2",
    "Violin1", "Violin2", "Violin3",
    "Viola1", "Viola2",
}

# Normalize matched instrument variants to English display names.
INSTRUMENT_NORMALIZE = {
    "Violon": "Violin", "Violon1": "Violin", "Violon2": "Violin",
    "Hautbois": "Oboe", "Hautbois1": "Oboe", "Hautbois2": "Oboe",
    "Clarinette": "Clarinet", "Clarinette1": "Clarinet", "Clarinette2": "Clarinet",
    "Basson": "Bassoon", "Basson1": "Bassoon", "Basson2": "Bassoon",
    "Cor": "Horn", "Cor1": "Horn", "Cor2": "Horn", "Cor3": "Horn", "Cor4": "Horn",
    "Trompette": "Trumpet", "Trompette1": "Trumpet", "Trompette2": "Trumpet",
    "Trombone1": "Trombone", "Trombone2": "Trombone", "Trombone3": "Trombone",
    "Timbales": "Timpani", "Timbales1": "Timpani",
    "Contrebasse": "Bass", "Contrebasses": "Bass", "Basses": "Bass",
    "HornF": "Horn",
    "Flute1": "Flute", "Flute2": "Flute", "Flute3": "Flute",
    "Piccolo1": "Piccolo", "Piccolo2": "Piccolo",
    "Violoncelle": "Cello",
    "Violine": "Violin", "Bratsche": "Viola", "Violoncell": "Cello",
    "Kontrabass": "Bass",
    "Flote": "Flute", "Klarinette": "Clarinet", "Fagott": "Bassoon",
    "Trompete": "Trumpet", "Posaune": "Trombone",
    "Pauken": "Timpani",
}

# 明显不相关的页面标题关键词
MW_JUNK_PATTERNS = re.compile(
    r'^(Wishlist|List of works|List of Compositions|List of Intermediate|'
    r'List of Easy|List of Difficult|List of)|\b(Plates|Durand|Heugel|'
    r'Augener|Breitkopf|Schott|Henle|Peters)\b',
    re.IGNORECASE,
)

# 从 IMSLP 标题中提取 composer，格式如: "Work Title (Beethoven, Ludwig van)"
COMPOSER_FROM_TITLE = re.compile(r'\(([^,]+,\s*[^)]+)\)$')

COMPOSER_PATTERN = re.compile(r'\s*\([^)]+\)$')

PERSON_DETAIL_MW_SUBCATEGORIES = {"Collections", "Collaborations", "Books", "Pasticcios"}
