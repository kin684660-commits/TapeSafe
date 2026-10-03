// 2-of-3 majority. y = (a & c) | (b & (a | c))
module maj3(
  input a,
  input b,
  input c,
  output y
);
  assign y = (a & c) | (b & (a | c));
endmodule
