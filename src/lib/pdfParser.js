// Parse uploaded PDF content into structured test-question data for the client editor.

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const QUESTION_START = /^(\d{1,3})[.):] +(?!only\b|and\b|or\b|to\b|of\b|in\b|the\b|is\b|are\b|was\b|were\b|[A-Z][a-z]+ +:)(.{15,})$/;
const OPTION_START = /^\s*[\(\[]?\s*([A-Da-d])\s*[\)\].:\-]\s+(.+)$/;
const INLINE_ANSWER = /(?:ans(?:wer)?|correct(?:\s*option)?|solution)\s*[:\-]?\s*\(?([A-Da-d])\)?/i;
const ANSWER_SECTION_TITLE = /(answer\s*key|correct\s*answers?|solutions?)/i;

// Handle the normalizeWhitespace logic for this module.
function normalizeWhitespace(value) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[�?�]/g, " ")
    .replace(/[��]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Handle the normalizeLines logic for this module.
function normalizeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

// Handle the detectColumnSplit logic for this module.
function detectColumnSplit(items) {
  const xs = items.map((item) => Number(item.transform?.[4] || 0));
  if (xs.length === 0) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const mid = (minX + maxX) / 2;
  const leftCount = xs.filter((x) => x < mid).length;
  const rightCount = xs.filter((x) => x >= mid).length;
  // Only treat as two-column if both sides have substantial content
  if (leftCount < 5 || rightCount < 5) return null;
  return mid;
}

// Handle the buildColumnText logic for this module.
function buildColumnText(items, minX, maxX) {
  const rows = new Map();
  items.forEach((item) => {
    if (!item.str || !String(item.str).trim()) return;
    const x = Number(item.transform?.[4] || 0);
    if (x < minX || x > maxX) return;
    const y = Number(item.transform?.[5] || 0);
    const key = String(Math.round(y));
    const current = rows.get(key) || [];
    current.push({ x, text: String(item.str) });
    rows.set(key, current);
  });
  return [...rows.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((i) => i.text).join(" "))
    .join("\n");
}

// Handle the buildPageText logic for this module.
function buildPageText(items) {
  const validItems = items.filter((item) => item.str && String(item.str).trim());
  const split = detectColumnSplit(validItems);

  if (!split) {
    const rows = new Map();
    validItems.forEach((item) => {
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      const key = String(Math.round(y));
      const current = rows.get(key) || [];
      current.push({ x, text: String(item.str) });
      rows.set(key, current);
    });
    return [...rows.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((i) => i.text).join(" "))
      .join("\n");
  }

  const allXs = validItems.map((item) => Number(item.transform?.[4] || 0));
  const pageMinX = Math.min(...allXs);
  const pageMaxX = Math.max(...allXs);
  const leftText = buildColumnText(validItems, pageMinX, split);
  const rightText = buildColumnText(validItems, split, pageMaxX + 1);
  return leftText + "\n" + rightText;
}

// Handle the extractPdfText logic for this module.
async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(buildPageText(content.items));
  }

  return pages.join("\n\n");
}

// Handle the splitInlineOptions logic for this module.
function splitInlineOptions(line) {
  // Match patterns like: ( a ) text  or  (a) text  or  a) text
  const matches = [...line.matchAll(/(^|\s)\(?\s*([A-Da-d])\s*\)?\s*[)\].:\-]?\s+(?=\S)/g)];

  if (matches.length < 2) {
    return null;
  }

  return matches
    .map((match, index) => {
      const start = match.index + match[1].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : line.length;
      return line.slice(start, end).trim();
    })
    .filter(Boolean);
}

// Handle the parseAnswerKey logic for this module.
function parseAnswerKey(lines) {
  const answerKey = new Map();
  let inAnswerSection = false;

  lines.forEach((line) => {
    if (ANSWER_SECTION_TITLE.test(line)) {
      inAnswerSection = true;
    }

    if (!inAnswerSection) {
      return;
    }

    const pairs = [...line.matchAll(/(\d{1,3})\s*[\].:\-)]*\s*\(?\s*([A-Da-d])\s*\)?/g)];
    pairs.forEach(([, number, option]) => {
      answerKey.set(Number(number), option.toUpperCase());
    });
  });

  return answerKey;
}

// Handle the lineLooksLikeQuestionStart logic for this module.
function lineLooksLikeQuestionStart(line) {
  const match = line.match(QUESTION_START);

  if (!match) {
    return false;
  }

  const body = normalizeWhitespace(match[2] || "");
  const wordCount = body.split(" ").filter(Boolean).length;

  if (body.includes(" : ") && wordCount <= 7 && !/[?)]$/.test(body)) {
    return false;
  }

  return true;
}

// Handle the parseQuestionBlocks logic for this module.
function blockHasOptionSignals(block) {
  let signalCount = 0;

  for (let index = 1; index < block.length; index += 1) {
    const line = block[index];
    if (OPTION_START.test(line)) {
      signalCount += 1;
    } else if ((splitInlineOptions(line) || []).length >= 2) {
      signalCount += 2;
    }

    if (signalCount >= 2) {
      return true;
    }
  }

  return false;
}

// Handle the parseQuestionBlocks logic for this module.
function parseQuestionBlocks(lines) {
  const blocks = [];
  let currentBlock = [];
  let currentQuestionNumber = 0;

  lines.forEach((line) => {
    if (lineLooksLikeQuestionStart(line)) {
      const nextQuestionNumber = Number(line.match(QUESTION_START)?.[1] || 0);
      if (currentBlock.length === 0) {
        currentBlock = [line];
        currentQuestionNumber = nextQuestionNumber;
        return;
      }

      if (nextQuestionNumber > currentQuestionNumber && blockHasOptionSignals(currentBlock)) {
        blocks.push(currentBlock);
        currentBlock = [line];
        currentQuestionNumber = nextQuestionNumber;
        return;
      }
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  });

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// Handle the finalizeOption logic for this module.
function finalizeOption(optionBuffer, options) {
  if (!optionBuffer) {
    return null;
  }

  const text = normalizeWhitespace(optionBuffer.text.join(" "));

  if (!text) {
    return null;
  }

  const option = {
    key: optionBuffer.key,
    text
  };
  options.push(option);
  return option;
}

// Handle the parseQuestionBlock logic for this module.
function parseQuestionBlock(block, answerKey) {
  const firstLine = block[0] || "";
  const questionMatch = firstLine.match(QUESTION_START);

  if (!questionMatch) {
    return null;
  }

  const questionNumber = Number(questionMatch[1]);
  const promptLines = [questionMatch[2] || ""].filter(Boolean);
  const options = [];
  let currentOption = null;
  let inlineCorrectOption = null;

  for (let index = 1; index < block.length; index += 1) {
    const line = block[index];

    if (!line) {
      continue;
    }

    const answerMatch = line.match(INLINE_ANSWER);
    if (answerMatch) {
      inlineCorrectOption = answerMatch[1].toUpperCase();
      continue;
    }

    const inlineOptions = splitInlineOptions(line);
    if (inlineOptions) {
      finalizeOption(currentOption, options);
      currentOption = null;

      inlineOptions.forEach((segment) => {
        const segmentMatch = segment.match(/^\(?\s*([A-Da-d])\s*\)?\s*[)\].:\-]?\s*(.+)$/);
        if (segmentMatch) {
          options.push({
            key: segmentMatch[1].toUpperCase(),
            text: normalizeWhitespace(segmentMatch[2])
          });
        }
        });
        continue;
      }

    const optionMatch = line.match(OPTION_START);
    if (optionMatch) {
      finalizeOption(currentOption, options);
      currentOption = {
        key: optionMatch[1].toUpperCase(),
        text: [optionMatch[2]]
      };
      continue;
    }

    if (currentOption) {
      currentOption.text.push(line);
    } else {
      promptLines.push(line);
    }
  }

  finalizeOption(currentOption, options);

  const uniqueOptions = options
    .filter((option, index, list) => list.findIndex((item) => item.key === option.key) === index)
    .slice(0, 4);

  if (uniqueOptions.length < 2) {
    return null;
  }

  return {
    id: `q-${questionNumber}`,
    number: questionNumber,
    prompt: normalizeWhitespace(promptLines.join(" ")),
    options: uniqueOptions,
    correctOption: inlineCorrectOption || answerKey.get(questionNumber) || "",
    parserNotes: [
      uniqueOptions.length !== 4 ? `Detected ${uniqueOptions.length} options` : null,
      !(inlineCorrectOption || answerKey.get(questionNumber)) ? "Correct answer not found automatically" : null
    ].filter(Boolean)
  };
}

// Read PDF text and convert it into structured questions for editing or import.
export async function parsePdfQuestions(file) {
  console.log("[pdfParser] starting parse for:", file.name);
  const rawText = await extractPdfText(file);
  console.log("[pdfParser] extracted text length:", rawText.length);
  console.log("[pdfParser] first 500 chars:\n", rawText.slice(0, 500));
  const lines = normalizeLines(rawText);
  console.log("[pdfParser] total lines:", lines.length);
  const answerKey = parseAnswerKey(lines);
  console.log("[pdfParser] answer key entries:", answerKey.size);
  const blocks = parseQuestionBlocks(lines);
  console.log("[pdfParser] question blocks found:", blocks.length);
  const questions = blocks
    .map((block) => parseQuestionBlock(block, answerKey))
    .filter(Boolean)
    .sort((left, right) => left.number - right.number);
  console.log("[pdfParser] final questions parsed:", questions.length);
  questions.forEach((q) => console.log(`  Q${q.number}: options=${q.options.map(o=>o.key).join(",")} correct=${q.correctOption}`));

  return {
    title: file.name.replace(/\.pdf$/i, ""),
    rawText,
    questions,
    warnings: [
      questions.length === 0 ? "No questions were detected. Try a clearer PDF or fix the parser result manually." : null,
      questions.some((question) => question.options.length !== 4)
        ? "Some questions do not have exactly four detected options."
        : null,
      questions.some((question) => !question.correctOption)
        ? "Some correct answers were not found automatically. Set them before starting the test."
        : null
    ].filter(Boolean)
  };
}
