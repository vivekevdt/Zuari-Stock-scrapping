import { Parser } from "json2csv";

export function generateCSV(data) {
    if (!data || data.length === 0) return null;
    const parser = new Parser();
    return parser.parse(data);
}
