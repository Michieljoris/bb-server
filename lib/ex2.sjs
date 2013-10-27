// functions can now be spelled def!
macro def {
  rule { $name $params $body } => {
    function $name $params $body
  }
}
def add (a, b) {
  return a + b;
}

console.log( add(3, 7) );
exports.one =  "hello";
