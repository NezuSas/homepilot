const prompt = "apaga la luz del cuarto master";
const esRegex = /(enciende|prende|apaga).*?(todo\s+el|todo\s+en|todo|todas\s+(?:las\s+)?luces|luces)\s*(?:en\s+|el\s+|del\s+|de\s+|la\s+|las\s+)?(.+)/i;
const match = prompt.match(esRegex);
console.log(match);
