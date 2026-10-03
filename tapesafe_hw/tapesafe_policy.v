// TapeSafe Policy v1: m-of-n (n <= 5) + maker-checker + required signer + freeze.
// Pin order is little-endian: appr[0] is bit 0 of the packed input.
module tapesafe_policy(
  input  [4:0] appr,
  input  [4:0] prop,
  input  [4:0] must,
  input  [2:0] m,
  input        frozen,
  output       ok
);
  wire [4:0] eff = appr & ~prop;
  wire [2:0] cnt = eff[0] + eff[1] + eff[2] + eff[3] + eff[4];
  wire must_ok = ((eff & must) == must);
  assign ok = ~frozen & (m != 3'd0) & (cnt >= m) & must_ok;
endmodule
