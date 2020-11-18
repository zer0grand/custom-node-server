const port = 8080;

const express = require('express');
const path = require('path');
const { createServer, request } = require('http');
const WebSocket = require('ws');
const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

// lists ///////////////////////////////////////////////////////////////////////
var lobbies = {}
var serverViewers = [];

// serve html //////////////////////////////////////////////////////////////////
app.use(express.static('public'))

// wss events //////////////////////////////////////////////////////////////////
wss.on('connection', function(ws) {
  // show in the console that a user joined //
  console.log("client "+ ws.userId +" joined");

  // create user's details //
  ws.userId = GetUniqueID();
  ws.userName = "anonymous";
  ws.lobbyId = -1;
  ws.gamemode = "spectator";

  // send a to all users that a new user joined //
  // NOTE: do this only to users in the same lobby in the future
  var returnMessage = {}
  returnMessage["type"] = "user-joined";
  returnMessage["data"] = {};
  returnMessage.data["user-id"] = ws.userId;
  returnMessage.data["user-name"] = ws.userName;
  returnMessage.data["lobby-id"] = ws.lobbyId;
  returnMessage.data["gamemode"] = ws.gamemode;

  wss.clients.forEach(function each(client) {
    if (client.userId != ws.userId) {
      client.send(JSON.stringify(returnMessage));
    }
  });

  // send the users datails to the user //
  var message = {
    "type": "user-details",
    "data": {
      "user-id": ws.userId,
      "user-name": ws.userName,
      "lobby-id": ws.lobbyId,
      "gamemode": ws.gamemode
    }
  }
  ws.send(JSON.stringify(message));

  // when user sends message //
  ws.on('message', function(data) {
    interpretMessage(ws, data);
  });

  // when user disconnects //
  ws.on('close', function() {
    // show in the console that a new user left //
    console.log("client "+ ws.userId +" left");

    var returnMessage = {}
    returnMessage["type"] = "user-left";
    returnMessage["data"] = {};
    returnMessage.data["user-id"] = ws.userId;
  
    wss.clients.forEach(function each(client) {
      if (client.userId != ws.userId) {
        client.send(JSON.stringify(returnMessage));
      }
    });

    // TODO: clear interval when sending dof data
  });
});

server.listen(port, function() {
  console.log(`Listening on http://localhost:${port}`);
});

// interpret message ///////////////////////////////////////////////////////////
function interpretMessage(ws, s) {
  message = JSON.parse(s);
  switch (message["type"]) {
    case "gamemode":
      ws.gamemode = message["data"]["gamemode"]
      break;
    case "list-users":
      ListUsers(ws);
      break;
    case "create-lobby":
      CreateLobby(ws);
      break;
    case "join-lobby":
      JoinLobby(ws);
      break;
    case "leave-lobby":
      KickUser(ws, -1, "you left the lobby");
      break;
    
    default:
      console.log("unknown message: " + message);
      break;
  }
}

// lobby logic /////////////////////////////////////////////////////////////////
function CreateLobby(ws) {
  ws.lobbyId = GenerateUniqueID();
  lobbies[ws.lobbyId] = {
    // for big servers //
    // "spectator": [],
    // "player": []

    // for small servers //
    "users": [ ],

    // unused //
    // "environment": null,
    // "black-list": [ ]
  }

  SendUserSuccess(ws, "create-lobby", "lobby created");
  // TODO: stop lobby creation if gamemode is not player or spectator
}

function JoinLobby(ws, lobbyId) {
  // see if lobby exists //
  if (!lobbies.hasOwnProperty(lobbyId)) {
    SendUserError(ws, "join-lobby", "lobby does not exist");
    return;
  }

  // add user to lobby gamemode //

  // for big servers //
  // switch (ws.gamemode) {
  //   case "player":
  //     lobbies[lobbyId]["player"].push(ws);
  //     ws.lobbyId = lobbyId;
  //     break;
  //   case "spectator":
  //     lobbies[lobbyId]["spectator"].push(ws);
  //     ws.lobbyId = lobbyId;
  //     break;
  //   // TODO: create default case
  //   // TODO: make function for joining instead of dupliate code
  // }

  // for small servers //
  lobbies[lobbyId]["users"].push(ws);
}

// kick a user from a lobby ////////////////////////////////////////////////////
function KickUser(ws, newLobbyId, customMessage) {
  // TODO: send server updated user data
  var oldLobbyId = ws.lobbyId;

  // remove user from server list //
  var index = lobbies[ws.lobbyId]["users"].indexOf(ws);
  if (index > -1) {
    lobbies[ws.lobbyId]["users"].splice(index, 1);
    ws.lobbyId = -1;
  }

  // tell user they've been kicked //
  ws.lobbyId = newLobbyId;
  ws.send({
    "type": "kicked-from-lobby",
    "data": {
      "new-lobby": newLobbyId,
      "reason": customMessage
    }
  });

  // delete lobby if everyone left //
  if (lobbies[ws.lobbyId]["users"].length === 0) {
    DeleteLobby(oldLobbyId);
  }
}

function DeleteLobby(lobbyId) {
  // for big servers //
  // for (var i=0; i<lobbies[lobbyId]["player"].length; i++) {
  //   KickUser(lobbies[lobbyId]["player"][i], -1, "lobby deleted");
  // }
  // for (var i=0; i<lobbies[lobbyId]["spectator"].length; i++) {
  //   KickUser(lobbies[lobbyId]["spectator"][i], -1, "lobby deleted");
  // }

  // for small servers //
  for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
    KickUser(lobbies[lobbyId]["users"][i], -1, "lobby deleted");
  }
  
  delete lobbies[lobbyId];
}

function ListLobbies() {
  // TODO
}

// return a list of users based on gamemode and lobby //////////////////////////
function ListUsers(ws) {
  var returnMessage = {}
  returnMessage["type"] = "user-list";
  returnMessage["data"] = [];
  
  switch (ws.gamemode) {
    case "server":
      wss.clients.forEach(function each(client) {
        var user = {}
        user["user-id"] = client.userId;
        user["user-name"] = client.userName;
        user["lobby-id"] = client.lobbyId;
        user["gamemode"] = client.gamemode;
        returnMessage.data.push(user);
      });
      break;
    case "player" || "spectator":
      if (ws.lobbyId === -1) {
        SendUserError(ws, "list-users", "not in a lobby")
        return;
      }
      for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
        var user = {}
        user["user-id"] = lobbies[lobbyId]["users"][i].userId;
        user["user-name"] = lobbies[lobbyId]["users"][i].userName;
        user["lobby-id"] = lobbies[lobbyId]["users"][i].lobbyId;
        user["gamemode"] = lobbies[lobbyId]["users"][i].gamemode;
        returnMessage.data.push(user);
      }
      break;
  }
  ws.send(JSON.stringify(returnMessage));
}

// used to tell a user that their request was successful ///////////////////////
function SendUserSuccess(ws, request, successMessage) {
  ws.send({
    "type": "success",
    "data": {
      "request": request,
      "success-message": successMessage
    }
  });
}

// used to tell a user that their request was unsuccessful /////////////////////
function SendUserError(ws, request, errorMessage) {
  ws.send({
    "type": "error",
    "data": {
      "request": request,
      "error-message": errorMessage
    }
  });
}

// create a UID ////////////////////////////////////////////////////////////////
function GenerateUniqueID() {
  // TODO: check to see if ID is truely unique //
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
}
