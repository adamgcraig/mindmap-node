
var primus = new Primus('127.0.0.1:8080/primus',{ });

primus.on('open', function open() {
  console.log("connection opened");
});

primus.on('data', function message(data) {
  handleUpdateFromServer(data);
});

primus.on('error', function error(err) {
  console.error("An error occurred: ", err);
});

//--called in view.js
function sendEditToServer(edit) {
    console.log("sendEditToServer: new edit: ");
    console.log(edit);
    
    primus.write(edit);
};//end of window.onmessage