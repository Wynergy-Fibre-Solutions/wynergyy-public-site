/**
 * Offline schema validation for ACE dormant tree.
 * Run manually. Not imported by UI or engine.
 */
import fs from "fs";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, strict: true });

const schema = JSON.parse(
  fs.readFileSync(new URL("./ace.tree.schema.json", import.meta.url))
);
const data = JSON.parse(
  fs.readFileSync(new URL("./ace.tree.json", import.meta.url))
);

const validate = ajv.compile(schema);
const ok = validate(data);

if (!ok) {
  console.error("ACE tree schema validation FAILED:");
  console.error(validate.errors);
  process.exit(1);
}

console.log("ACE tree schema validation PASSED.");
