var http = require("http");
var https = require("https");

// ######### Prep Database
var MongoClient = require('mongodb').MongoClient,
    ObjectID = require('mongodb').ObjectID,
    BSON = require('mongodb').pure().BSON;
var db = null
var users = null, traps = null, dinos = null;
MongoClient.connect("mongodb://localhost:27017/dinotrap", function(err, dbgiven) {
  if(!err) {
    console.log("We are connected");
	db = dbgiven;
	users = db.collection("users");
	traps = db.collection("traps");
	dinos = db.collection("dinos");
	console.log("collecitons ready");
  } else {
	"DB Problems baby"
  }
});

// #######  Utility Code

var utils = {};
// JSON HTTP method
// takes option object with host, port, path, method keys.  headers obj
// returns the json to onResult function
utils.getJSON = function(options, onResult)
{
    console.log("rest::getJSON");

    var prot = options.port == 443 ? https : http;
    var req = prot.request(options, function(res)
    {
        var output = '';
        console.log(options.host + ':' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function() {
            var obj = JSON.parse(output);
            onResult(res.statusCode, obj);
        });
    });

    req.on('error', function(err) {
		console.log("Error on HTTP(S) call");
        //res.send('error: ' + err.message);
    });

    req.end();
};

// non-blocking array process for array of items, to function process, with delay ms
utils.processArray = function(delay, items, process) {
    var todo = items.concat();

    setTimeout(function() {
        process(todo.shift());
        if(todo.length > 0) {
            setTimeout(arguments.callee, delay);
        }
    }, delay);
};



var wmataKey = "4pu4tjvxxaf88vsbf8vcze5w";
var wmataOptions = {
    host: 'api.wmata.com',
    port: 80,
    path: '/Bus.svc/json/jBusPositions?includingVariations=true&api_key=' + wmataKey,
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

utils.getJSON(wmataOptions, function(statusCode, result){
	
	
	if(statusCode === 200) {
		utils.processArray(10, result.BusPositions, function(b){
			console.log("Found bus with id: "+ b.VehicleID);
			

			dinos.update(
				{_id: b.VehicleID},
				{ 
					$set: {
						"type": "wmata bus",
						"lastModified": b.DateTime,
						"RouteID": b.RouteID,
						"VehicleID": b.VehicleID
					},
					$push: { positions: {
						$each: [{
							pos: [b.Lon, b.Lat],
							time: b.DateTime
						}],
						$slice: -1
					}}
				},
				{
					upsert: true,
					multi:false
				},
				function(err,data) { 
					console.log("   db confirmation"); 
				}
			); 
			
		});
		
	} else {
		console.log("Error");
	}
});



//	use dinotrap;
//	db.dinos.ensureIndex( { "positions.pos": "2d" } )