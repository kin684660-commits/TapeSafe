// Optional sequential demo. State is NOT stored by the circuit: step() is a view,
// and the caller must keep the latch bits. Not used by the treasury executor.
module approval_reg(
  input clk,
  input [4:0] sig,
  input clr,
  input [2:0] m,
  output ok,
  output [4:0] q
);
  reg [4:0] r = 5'b0;
  always @(posedge clk) r <= clr ? 5'b0 : (r | sig);
  wire [2:0] cnt = r[0] + r[1] + r[2] + r[3] + r[4];
  assign ok = (m != 3'd0) & (cnt >= m);
  assign q = r;
endmodule
