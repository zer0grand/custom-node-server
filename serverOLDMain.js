const port = 8080;

const express = require('express');
const path = require('path');
const { createServer, request } = require('http');
const WebSocket = require('ws');
const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

const nullLobbyId = "00000000-0000"

// TODO: update users on other users' statuses
// TODO: be able to show users lobby lists
// TODO: user-list is represented differently between a server viewer and a player, fix server viewers to be like players

// MAJOR TODO: make it so all data is sent every update, don't let clients determine multiplayer hz 
// lobby would have format lobbies = {"lobbyid1-1234":{"userid12-1234":{"data1":"data1","data2","data2"}}}

// lists ///////////////////////////////////////////////////////////////////////
var lobbies = {}
var serverViewers = [];

// serve html //////////////////////////////////////////////////////////////////
app.use(express.static('public'))

// wss events //////////////////////////////////////////////////////////////////
wss.on('connection', function(ws) {
  // create user's details //
  ws.userId = GenerateUniqueID();
  ws.userName = "anonymous";
  ws.lobbyId = nullLobbyId;
  ws.gamemode = "spectator";
  ws.connected = true;
  
  // show in the console that a user joined //
  console.log("client "+ ws.userId +" joined");

  // tell all server viewers that a user joined
  SendUserJoinedServer(ws);

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
    InterpretMessage(ws, data);
  });

  // when user disconnects //
  ws.on('close', function() {
    ws.connected = false;

    // show in the console that a new user left //
    console.log("client "+ ws.userId +" left");

    SwitchGamemode(ws, "spectator");
    KickUser(ws, ws.lobbyId, nullLobbyId, "user left server");
    SendUserLeftServer(ws);

    // TODO: clear interval when sending dof data
  });
});

// web server //////////////////////////////////////////////////////////////////
server.listen(port, function() {
  console.log(`Listening on http://localhost:${port}`);
});

// interpret message ///////////////////////////////////////////////////////////
function InterpretMessage(ws, s) {
  message = JSON.parse(s);
  // console.log("message from "+ ws.userId +" type "+ message["type"]);
  switch (message["type"]) {
    case "switch-gamemode":
      SwitchGamemode(ws, message["data"]["gamemode"]);
      break;
    case "list-users":
      ListUsers(ws);
      break;
    case "list-lobbies":
      ListLobbies(ws);
      break;
    case "create-lobby":
      CreateLobby(ws);
      break;
    case "join-lobby":
      JoinLobby(ws, message["data"]["lobby-id"]);
      break;
    case "leave-lobby":
      KickUser(ws, ws.lobbyId, nullLobbyId, "you left the lobby");
      break;
    case "user-message":
      RelayUserMessage(ws, message["data"]);
      break;
    
    default:
      console.log("unknown message: " + message);
      break;
  }
}

function LobbyUpdateTick(lobbyId) {
  
}

// send message from one player to all others in the same lobby //
function RelayUserMessage(ws, data) {
  // TODO: only send data to players
  if (ws.lobbyId === nullLobbyId) {
    return;
  }
  var lobby = lobbies[ws.lobbyId]["users"];
  for (var i=0; i<lobby.length; i++) {
    if (lobby[i] !== ws) {
      lobby[i].send(JSON.stringify({
        "type": "user-message",
        "data": {
          "user-id": ws.userId,
          "data": data
        }
      }));
    }
  }
}

// switch a user's gamemode ////////////////////////////////////////////////////
function SwitchGamemode(ws, gamemode) {
  if (gamemode !== "server" && ws.gamemode === "server") { // see if user is going from server to non-server
    // remove user from list //
    var index = serverViewers.indexOf(ws);
    if (index > -1) {
      serverViewers.splice(index, 1);
    }
  } else if (gamemode === "server" && ws.gamemode !== "server") { // see if user is going from non-server to server
    serverViewers.push(ws);
  }
  ws.gamemode = gamemode;

  if (ws.connected) {
    // tell the user they successfully switched their gamemode //
    SendUserSuccess(ws, "switch-gamemode", gamemode);
  
    // tell server viewers that the user changed their gamemode //
    ServerViewerBroadcastUserUpdate(ws);
  }
}

// create a lobby //////////////////////////////////////////////////////////////
function CreateLobby(ws) {
  // TODO: stop lobby creation if gamemode is not player or spectator
  var newLobbyId = GenerateUniqueID();
  lobbies[newLobbyId] = {
    "users": [ ], // a list of all ws clients in the lobby

    // will be used in the future //
    // "environment": null, // the map name
    // "black-list": [ ] // banned players
  }

  // tell user the lobby was created successfully //
  SendUserSuccess(ws, "create-lobby", "lobby created");
  // tell all server viewers there is a new lobby //
  ServerViewerBroadcastLobbyUpdate(newLobbyId, "created");
  // make the user join the new lobby //
  JoinLobby(ws, newLobbyId);
}

// make a user join a lobby ////////////////////////////////////////////////////
function JoinLobby(ws, lobbyId) {
  if (lobbyId === nullLobbyId) {
    return;
  }

  // see if lobby exists //
  if (!lobbies.hasOwnProperty(lobbyId)) {
    SendUserError(ws, "join-lobby", "lobby does not exist");
    return;
  }

  // make sure user is not duplicated
  if (lobbies[lobbyId]["users"].indexOf(ws) > -1) {
    SendUserError(ws, "join-lobby", "user already in lobby");
    return;
  }

  // see if user is already in lobby
  if (ws.lobbyId !== nullLobbyId) {
    KickUser(ws, ws.lobbyId, nullLobbyId, "joining new lobby");
  }

  ws.lobbyId = lobbyId;

  // add user to lobby //
  lobbies[lobbyId]["users"].push(ws);
  SendUserSuccess(ws, "join-lobby", lobbyId);
  ListUsers(ws);

  // tell other users a new user joined //
  SendUserJoined(ws);
}

// kick a user from a lobby ////////////////////////////////////////////////////
function KickUser(ws, currentLobbyId, newLobbyId, customMessage) {
  // TODO: distinguish between being kicked and disconnecting, the current disconnect gives a kicked from lobby message
  if (currentLobbyId === nullLobbyId) {
    return;
  }

  // remove user from server list //
  var index = lobbies[currentLobbyId]["users"].indexOf(ws);
  if (index > -1) {
    lobbies[currentLobbyId]["users"].splice(index, 1);
    ws.lobbyId = nullLobbyId;
  } else {
    return; // user is not in lobby
  }

  // tell user they've been kicked //
  ws.lobbyId = newLobbyId;
  if (ws.connected) {
    var returnMessage = {
      "type": "kicked-from-lobby",
      "data": {
        "new-lobby": newLobbyId,
        "reason": customMessage
      }
    };
    ws.send(JSON.stringify(returnMessage));
  }

  // tell all users in the lobby that the user left //
  SendUserLeft(ws, currentLobbyId);

  // tell server viewers the user left the lobby //
  ServerViewerBroadcastUserUpdate(ws);

  // delete lobby if everyone left //
  if (lobbies[currentLobbyId].users.length === 0) {
    DeleteLobby(currentLobbyId);
  }
}

// delete a lobby //////////////////////////////////////////////////////////////
function DeleteLobby(lobbyId) {
  for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
    KickUser(lobbies[lobbyId]["users"][i], lobbies[lobbyId]["users"][i].lobbyId, nullLobbyId, "lobby deleted");
  }

  // tell server viewers the lobby was deleted //
  ServerViewerBroadcastLobbyUpdate(lobbyId, "deleted");
  
  delete lobbies[lobbyId];
}

// send a list of all lobbies to user //////////////////////////////////////////
function ListLobbies(ws) {
  // TODO: also send number of players/spectators //
  var returnMessage = {
    "type": "lobby-list",
    "data": {
      "lobbies": [ ]
    }
  }

  returnMessage["data"]["lobbies"] = Object.keys(lobbies);

  ws.send(JSON.stringify(returnMessage));
}

// return a list of users based on gamemode and lobby //////////////////////////
function ListUsers(ws) {
  var returnMessage = {}
  returnMessage["type"] = "user-list";
  returnMessage["data"] = [ ];

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
      ws.send(JSON.stringify(returnMessage));
      break;
    case "player" || "spectator":
      if (ws.lobbyId === nullLobbyId) {
        SendUserError(ws, "list-users", "not in a lobby")
        return;
      }
      for (var i=0; i<lobbies[ws.lobbyId]["users"].length; i++) {
        var client = lobbies[ws.lobbyId]["users"][i];
        var newEntry = { };
        newEntry["user-id"] = client.userId
        newEntry["user-name"] = client.userName;
        newEntry["gamemode"] = client.gamemode;
        returnMessage["data"].push(newEntry);
      }
      ws.send(JSON.stringify(returnMessage));
      break;
  }
}

// tell users in a lobby that a new user joined ////////////////////////////////
function SendUserJoined(ws) {
  var returnMessage = {}
  returnMessage["type"] = "user-joined";
  returnMessage["data"] = {};
  returnMessage.data["user-id"] = ws.userId;
  returnMessage.data["user-name"] = ws.userName;
  returnMessage.data["gamemode"] = ws.gamemode;

  // tell all users in the lobby that a user joined the lobby //
  LobbyUserBroadcast(ws, ws.lobbyId, returnMessage);

  // tell server viewers a user joined a lobby //
  ServerViewerBroadcastUserUpdate(ws);
}

// tell users in a lobby that a user left ///////////////////////////////////////
function SendUserLeft(ws, lobbyId) {
  var returnMessage = {}
  returnMessage["type"] = "user-left";
  returnMessage["data"] = {};
  returnMessage.data["user-id"] = ws.userId;

  // tell all users in the lobby that a user joined the lobby //
  LobbyUserBroadcast(ws, lobbyId, returnMessage);

  // tell server viewers a user joined a lobby //
  ServerViewerBroadcastUserUpdate(ws);
}

// used to tell all server viewers that a user joined //////////////////////////
function SendUserJoinedServer(ws) {
  var returnMessage = {}
  returnMessage["type"] = "user-joined-server";
  returnMessage["data"] = {};
  returnMessage.data["user-id"] = ws.userId;
  returnMessage.data["user-name"] = ws.userName;
  returnMessage.data["lobby-id"] = ws.lobbyId;
  returnMessage.data["gamemode"] = ws.gamemode;

  // don't use SendToAllServerViewers because we don't want to send this to the newly joined viewer //
  for (var i=0; i<serverViewers.length; i++) {
    if (serverViewers[i].userId != ws.userId) {
      serverViewers[i].send(JSON.stringify(returnMessage));
    }
  }
}

// used to tell all server viewers that a user left ////////////////////////////
function SendUserLeftServer(ws) {
  var returnMessage = {}
  returnMessage["type"] = "user-left-server";
  returnMessage["data"] = {};
  returnMessage.data["user-id"] = ws.userId;

  // don't use SendToAllServerViewers because we don't want to send this to the newly joined viewer //
  for (var i=0; i<serverViewers.length; i++) {
    if (serverViewers[i].userId != ws.userId) {
      serverViewers[i].send(JSON.stringify(returnMessage));
    }
  }
}





// broadcast message to all users in a lobby ///////////////////////////////////
function LobbyUserBroadcast(ws, lobbyId, message) {
  if (lobbyId === nullLobbyId) {
    return;
  }
  message = JSON.stringify(message);
  for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
    if (lobbies[lobbyId]["users"][i].userId != ws.userId) {
      lobbies[lobbyId]["users"][i].send(message);
    }
  }
}

// broadcast message to all server viewers /////////////////////////////////////
function ServerViewerBroadcast(message) {
  message = JSON.stringify(message);
  for (var i=0; i<serverViewers.length; i++) {
    serverViewers[i].send(message);
  }
}

// broadcast a message to all server viewers except for ws /////////////////////
function ServerViewerBroadcastExclude(ws, message) {
  message = JSON.stringify(message);
  for (var i=0; i<serverViewers.length; i++) {
    if (ws !== null && ws.userId === serverViewers[i].userId) {
      break;
    }
    serverViewers[i].send(message);
  }
}

// broadcast a user's updated information to server viewers ////////////////////
function ServerViewerBroadcastUserUpdate(ws) {
  var returnMessage = {}
  returnMessage["type"] = "user-update";
  returnMessage["data"] = {};
  returnMessage.data["user-id"] = ws.userId;
  returnMessage.data["user-name"] = ws.userName;
  returnMessage.data["lobby-id"] = ws.lobbyId;
  returnMessage.data["gamemode"] = ws.gamemode;
  ServerViewerBroadcastExclude(ws, returnMessage);
}

// broadcast a lobby's updated information to server viewers ////////////////////
function ServerViewerBroadcastLobbyUpdate(lobbyId, status) {
  // currently the lobby updates are sent to all users //

  var returnMessage = {}
  returnMessage["type"] = "lobby-update";
  returnMessage["data"] = {};
  returnMessage.data["lobby-id"] = lobbyId
  returnMessage.data["status"] = status;
  // ServerViewerBroadcast(returnMessage);

  wss.clients.forEach(function each(client) {
    client.send(JSON.stringify(returnMessage));
  });
}

// tell a user that their request was successful ///////////////////////////////
function SendUserSuccess(ws, request, successMessage) {
  var returnMessage = {
    "type": "success",
    "data": {
      "request": request,
      "success-message": successMessage
    }
  }
  ws.send(JSON.stringify(returnMessage));
}

// used to tell a user that their request was unsuccessful /////////////////////
function SendUserError(ws, request, errorMessage) {
  ws.send(JSON.stringify({
    "type": "error",
    "data": {
      "request": request,
      "error-message": errorMessage
    }
  }));
}

// create a UID ////////////////////////////////////////////////////////////////
function GenerateUniqueID() {
  // TODO: check to see if ID is truely unique //
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
}
