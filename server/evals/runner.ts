import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { ChatbotService } from '../src/modules/ai/chatbot.service';
import { toolRegistry } from '../src/modules/ai/chatbot/tool-registry';
import { judge, JudgeResult } from './judge';

interface GoldenCase {
  id: string;
  group: string;
  input: string;
  history: Array<{ role: string; content: string }>;
  judge_criteria: string[];
  expected_tool_in?: string[];
  expected_no_tool?: boolean;
}

interface GoldenSet {
  version: number;
  cases: GoldenCase[];
}

interface CaseReport {
  id: string;
  group: string;
  input: string;
  reply: string;
  durationMs: number;
  judgeResult: JudgeResult;
  expectationCheck: { pass: boolean; reason: string };
  overall: 'pass' | 'fail';
}

function checkExpectations(c: GoldenCase, _reply: string, toolsUsed: string[]): { pass: boolean; reason: string } {
  if (c.expected_no_tool && toolsUsed.length > 0) {
    return { pass: false, reason: `Expected no tool but called: ${toolsUsed.join(', ')}` };
  }
  if (c.expected_tool_in && c.expected_tool_in.length > 0) {
    const ok = c.expected_tool_in.some((t) => toolsUsed.includes(t));
    if (!ok) {
      return { pass: false, reason: `Expected one of [${c.expected_tool_in.join(', ')}], got [${toolsUsed.join(', ') || 'none'}]` };
    }
  }
  return { pass: true, reason: 'ok' };
}

async function runOne(c: GoldenCase): Promise<CaseReport> {
  const startedAt = Date.now();
  const fakeUser = { id: 'eval-runner', email: 'eval@local', role: 'admin' };
  const toolsUsed: string[] = [];
  const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];
  const off = toolRegistry.onCall((info) => {
    toolsUsed.push(info.name);
    toolCalls.push(info);
  });
  let reply = '';
  try {
    reply = await ChatbotService.chat(c.input, c.history, [], fakeUser);
  } catch (err: any) {
    reply = `[ERROR] ${err?.message || 'unknown'}`;
  } finally {
    off();
  }
  const durationMs = Date.now() - startedAt;
  const expectationCheck = checkExpectations(c, reply, toolsUsed);

  let judgeResult: JudgeResult;
  try {
    judgeResult = await judge({
      input: c.input,
      reply,
      toolsUsed,
      toolCalls,
      criteria: c.judge_criteria,
    });
  } catch (err: any) {
    judgeResult = {
      scores: [],
      passCount: 0,
      total: c.judge_criteria.length,
      overall: 'fail',
    };
    console.error(`Judge failed for ${c.id}: ${err?.message}`);
  }

  const overall: 'pass' | 'fail' =
    judgeResult.overall === 'pass' && expectationCheck.pass ? 'pass' : 'fail';

  return { id: c.id, group: c.group, input: c.input, reply, durationMs, judgeResult, expectationCheck, overall };
}

async function main(): Promise<void> {
  const goldenPath = path.join(__dirname, 'golden-set.json');
  const golden: GoldenSet = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  const filterId = process.argv[2];
  const cases = filterId ? golden.cases.filter((c) => c.id === filterId) : golden.cases;
  if (!cases.length) {
    console.error('No cases matched.');
    process.exit(1);
  }

  console.log(`Aura eval — ${cases.length} case(s)`);
  console.log('─'.repeat(60));

  const reports: CaseReport[] = [];
  for (const c of cases) {
    process.stdout.write(`▶ ${c.id} [${c.group}]: ${c.input.slice(0, 50)}... `);
    const r = await runOne(c);
    reports.push(r);
    const mark = r.overall === 'pass' ? '✓' : '✗';
    console.log(`${mark} (${r.judgeResult.passCount}/${r.judgeResult.total}, ${r.durationMs}ms)`);
    if (r.overall === 'fail') {
      for (const s of r.judgeResult.scores) {
        if (!s.pass) console.log(`    × ${s.criterion}: ${s.reason}`);
      }
      if (!r.expectationCheck.pass) console.log(`    × expectation: ${r.expectationCheck.reason}`);
    }
  }

  console.log('─'.repeat(60));
  const passed = reports.filter((r) => r.overall === 'pass').length;
  const total = reports.length;
  const groups = new Map<string, { pass: number; total: number }>();
  for (const r of reports) {
    const g = groups.get(r.group) || { pass: 0, total: 0 };
    g.total++;
    if (r.overall === 'pass') g.pass++;
    groups.set(r.group, g);
  }

  console.log(`\nGroup        | Pass / Total`);
  for (const [g, s] of groups) {
    console.log(`${g.padEnd(12)} | ${s.pass}/${s.total}`);
  }
  console.log(`\nTOTAL: ${passed}/${total} pass`);

  const reportPath = path.join(__dirname, 'reports', `report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), passed, total, reports }, null, 2));
  console.log(`Report saved: ${reportPath}`);

  if (passed < total) process.exit(1);
}

main().catch((err) => {
  console.error('Eval runner crashed:', err);
  process.exit(1);
});
