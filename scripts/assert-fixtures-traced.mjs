import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverDir = path.join(root, ".next", "server");
const apiDir = path.join(serverDir, "app", "api");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function posix(file) {
  return file.split(path.sep).join("/");
}

const fixtureFiles = walk(path.join(root, "fixtures"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => posix(path.relative(root, file)))
  .sort();

const nftFiles = walk(apiDir).filter((file) => file.endsWith("route.js.nft.json"));
const failures = [];

if (fixtureFiles.length === 0) failures.push("no JSON files under fixtures/");
if (nftFiles.length === 0) failures.push("no API route traces under .next/server/app/api");

function readTrace(nftPath) {
  const trace = JSON.parse(fs.readFileSync(nftPath, "utf8"));
  const base = path.dirname(nftPath);
  const files = Array.isArray(trace.files) ? trace.files : [];
  return files.map((rel) => {
    const normalized = posix(rel);
    return { rel: normalized, abs: path.resolve(base, rel) };
  });
}

function findNft(suffix) {
  return nftFiles.find((file) => posix(file).endsWith(suffix));
}

for (const nftPath of nftFiles) {
  const files = readTrace(nftPath);
  const label = posix(path.relative(serverDir, nftPath));
  for (const fixture of fixtureFiles) {
    if (!files.some((file) => file.rel.endsWith(fixture))) {
      failures.push(`${label} does not trace ${fixture}`);
    }
  }
}

function tracedJsContains(nftPath, needle) {
  if (!nftPath) return false;
  const files = readTrace(nftPath);
  const candidates = [
    nftPath.replace(/\.nft\.json$/, ""),
    ...files
      .filter((file) => file.abs.endsWith(".js") && !posix(file.abs).includes("/node_modules/"))
      .map((file) => file.abs),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    if (fs.readFileSync(file, "utf8").includes(needle)) return true;
  }
  return false;
}

const inlineChecks = [
  ["app/api/runs/route.js.nft.json", ["PACK-v1", "CASE-2041", "CASE-2077", "CASE-2118", "CB-CONFIDENCE"]],
  ["app/api/runs/[runId]/play/route.js.nft.json", ["PACK-v1", "CASE-2041"]],
  ["app/api/runs/[runId]/step/route.js.nft.json", ["CASE-2041"]],
  ["app/api/cases/route.js.nft.json", ["CASE-2041", "CASE-2077", "CASE-2118"]],
  ["app/api/breakers/route.js.nft.json", ["CB-DATA-EGRESS", "CB-CONFIDENCE"]],
];

for (const [suffix, needles] of inlineChecks) {
  const nftPath = findNft(suffix);
  if (!nftPath) {
    failures.push(`missing trace ${suffix}`);
    continue;
  }
  for (const needle of needles) {
    if (!tracedJsContains(nftPath, needle)) {
      failures.push(`${suffix} server bundle is missing inlined fixture text ${needle}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Fixture tracing check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Fixture tracing check passed (${fixtureFiles.length} JSON files on ${nftFiles.length} API routes, inlined into the server bundles).`,
);
