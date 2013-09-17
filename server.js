/**
	DinoTrap
	A localized game involving dinosaurs, traps, etc
*/

var express = require("express");
var http = require("http");
var app = express();
var server = http.createServer(app);
var io = require("socket.io").listen(server);


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



// ######## Map

app.map = {
	// convert decimal degrees to radians
	toRad: function(number) {
		return number * Math.PI / 180.0
	},
	
	// calculate the distance between two latlon pairs
	calcDistance: function (lat1, lon1, lat2, lon2) {
		var R = 3956.6; // miles
		var dLat = app.map.toRad(lat2-lat1);
		var dLon = app.map.toRad(lon2-lon1).toRad();
		var lat1 = app.map.toRad(lat1);
		var lat2 = app.map.toRad(lat2);

		var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		var d = R * c;
		return d;
	}
};


app.NewUser = function(name, cb) {
	
	console.log( "NewUser");
	console.log( name );
	
	users.findOne({ "name": name.toLowerCase() }, function(err, user) {
		if( user != null ) {
			console.log("found user: "+user);
			cb( user._id , user.points );
		} else {
			user = {"name": name, "points": 0};
			users.insert(user, {"w":"majority"}, function(err, result){
				console.log("inserting user: " + user);
				cb( user._id, user.points);
			});
			
		}
	});
	
};



// submit messae to MarkLogic for placing a Trap
app.PlaceTrap= function(data, cb) {
	
	console.log("PlaceTrap: ");
	console.log(data);
	
	    //  path: "/survivor/" +data.id+ "/trap/" +data.lat+ "," +data.lon+ "?format=json",
	
	cb( 1 , 1, null, 1 )
	
};


// tell MarkLogic that it is time to ask WMATA for bus positions
app.DCDinos = function() {
	console.log( "DCDinos" )
};

// a user is requesting information near their location
app.NearMe = function(data, cb) {
	
	console.log( "NearMe" );
	console.log( data );
	
	users.update({'_id': ObjectID(data.id)}, 
		{"$set" : {"location": [data.lon, data.lat]} }, 
		function(err, item){
			// issue geoNear query
// db.command( { geoNear: "dinos", near: [-77.032768, 38.941021], spherical:true, uniqueDocs:true } , function(err, data) { if(data && data.results) console.log( data.results.length) } );

			console.log("Finding dinos near: " + [data.lon, data.lat] );

			db.command(
				{ 
					geoNear: "dinos", 
					near:  [data.lon, data.lat] , 
					spherical:true , 
					uniqueDocs: true,
					limit: 20
					//maxDistance: 1/69
				}, 
				function(err, data) {
					console.log("The following dinos are near this: ");
					console.log(data);
					
					var dinos = [];
					
					console.log(  data );
					
					if(data && data.results && data.results.length > 0) {
						
						data.results.forEach(function(element, index, array){
						
							var dino = {
								id: element.obj.VehicleID,
								"lat": element.obj.positions[0].pos[1],							
								"lon": element.obj.positions[0].pos[0]
							}
							console.log(dino);
							dinos.push(dino);
						
						});
					}
					
					cb( {"dinos": dinos, "traps":[]} );
				}
			)
			
		}
	);
	
	
	
	
	
	var path = "/survivor/"+data.id+"/nearMe/"+data.lat+","+data.lon+"?format=json";
	
};



io.sockets.on("connection", function(socket) {
	
	socket.on('login', function (data) {
	    socket.set('name', data.name, function() {
			app.NewUser(data.name, function(id, points) {
				//console.log("id: "+id+" points: "+points);
				socket.join(id);
				socket.to(id).emit("login-accepted", {
					"name": data.name, 
					"id": id, 
					"points": points}
				)
				
				socket.broadcast.emit("otherPlayerPosition", {name:data.name, id:id, lat:data.lat, lon:data.lon});
				
			});
		});
		
		
		socket.on('placeTrap', function(data) {
			app.PlaceTrap(data, function (trapId, survivorId, location, distance) {
				io.sockets.emit("trapPlaced", {"trapId":trapId, "survivorId": survivorId, "location": location, "distance": distance});
				console.log("I placed a trap: "+trapId+" at location: "+location);
			})
		});
		
		socket.on('nearMe', function(data) {
			console.log("nearMe Request");
			app.NearMe(data, function(nearData) {
				io.sockets.to(data.id).emit("thingsNearYou", nearData);
			});
		});
		
		socket.on('myPosition', function(data) {
			console.log("myPosition Request");
			socket.broadcast.emit('otherPlayerPosition', data);
			app.NearMe(data, function(nearData) {
				console.log("myPosition Request + sendingNearYou");
				io.sockets.to(data.id).emit("thingsNearYou", nearData);
			});
		});
		
   	});
	
});


// ######## WEB SERVER STUFF #############
app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

server.listen( 3000, function() {
	console.log("Express server");
});