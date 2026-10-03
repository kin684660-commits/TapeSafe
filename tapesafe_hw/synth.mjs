import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runYosys } from "@yowasp/yosys";

const jobs = [
  {
    model: "maj3",
    script: "read_verilog maj3.v; synth -flatten -top maj3; abc -g NAND; opt_clean; stat; write_blif maj3.blif",
  },
  {
    model: "tapesafe_policy",
    script: "read_verilog tapesafe_policy.v; synth -flatten -top tapesafe_policy; abc -g NAND; opt_clean; stat; write_blif tapesafe_policy.blif",
  },
  {
    model: "approval_reg",
    script: "read_verilog approval_reg.v; synth -flatten -top approval_reg; dfflegalize -cell $_DFF_P_ 0; abc -g NAND; opt_clean; stat; write_blif approval_reg.blif",
  },
];

mkdirSync("build", { recursive: true });
for (const job of jobs) {
  const source = readFileSync(`${job.model}.v`);
  let log = "";
  const out = await runYosys(["-p", job.script], { [`${job.model}.v`]: source }, {
    stdout: (bytes) => { if (bytes) log += new TextDecoder().decode(bytes); },
    stderr: (bytes) => { if (bytes) log += new TextDecoder().decode(bytes); },
  });
  const blif = out[`${job.model}.blif`];
  if (!blif) throw new Error(`${job.model}: yosys wrote no blif\n${log}`);
  writeFileSync(`${job.model}.blif`, blif);
  writeFileSync(`build/${job.model}.stat.txt`, log);
  console.log(`\n===== ${job.model} =====`);
  console.log(log.split("\n").filter((line) => /NAND|Number of cells|\$_NAND_|DFF|Latch/i.test(line)).join("\n"));
}
