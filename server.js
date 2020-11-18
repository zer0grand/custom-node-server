/******************************************************************************/
// node server by Corbin Peters
/******************************************************************************/

// TODO: = things that require implementation
// OPT: = things that could be optimized
// SEC: = things that could be more secure

const v8 = require('v8');

const port = 8080;

const tickHertz = 30;

const express = require('express');
const path = require('path');
const { createServer, request } = require('http');
const WebSocket = require('ws');
const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

const nullUserId = "00000000-0000";
const nullLobbyId = "00000000-0000";

const verbose = false;

// lists ///////////////////////////////////////////////////////////////////////
var lobbies = { }
var multiplayerLobbies = [ ];
var serverViewers = [ ];

// watch out for using arrays in these templates, or you have to implement some v8
const userVars = {
  "userId": nullUserId,
  "lobbyId": nullLobbyId,

  "userName": "anonymous",
  "gamemode": "spectator",
  "connected": true,

  "adminLevel": 0,

  "gameData": { },
  "cosmeticData": { }
}

const lobbyVars = {
  "users": [ ],
  "tickData": {
    "users": { },
    "lobby": { }
  },

  "environment": "default",
  "bannedIds": [ ]
}

// server formatting ///////////////////////////////////////////////////////////
const str_localUserInit = "local-user-init";
const str_userStatusUpdate = "user-status-update";
const str_localUserCreateLobby = "create-lobby";
const str_localUserJoinLobby = "local-user-join";
const str_localUserLeaveLobby = "local-user-leave";
const str_remoteUserJoinLobby = "remote-user-join";
const str_remoteUserLeaveLobby = "remote-user-leave";
const str_localUserGameData = "local-user-update";
const str_lobbyTickData = "lobby-tick-data";
const str_lobbyList = "lobby-list";

// serve html //////////////////////////////////////////////////////////////////
app.use(express.static('public'))

// web server //////////////////////////////////////////////////////////////////
server.listen(port, function() {
  console.log(`Listening on http://localhost:${port}`);
});

// wss events //////////////////////////////////////////////////////////////////
wss.on('connection', function(ws) {
  // create user's details //
  User_Create(ws);

  // show in the console that a user joined //
  console.log("client "+ ws.userId +" joined");

  // when user sends message //
  ws.on('message', function(data) {
    InterpretMessage(ws, data);
  });

  // when user disconnects //
  ws.on('close', function() {
    ws.connected = false;

    // show in the console that a new user left //
    console.log("client "+ ws.userId +" left");

    //TODO: fix the following lines
    User_LeaveLobby(ws, ws.lobbyId, nullLobbyId);

    // TODO: clear interval when sending dof data
  });
});

// interpret message ///////////////////////////////////////////////////////////
function InterpretMessage(ws, s) {
  message = JSON.parse(s);
  if (verbose) {
    console.log("message from "+ ws.userId +" type "+ message["type"]);
  }
  switch (message["type"]) {
    case str_localUserCreateLobby:
      Lobby_Create(ws);
      break;
    case str_localUserJoinLobby:
      User_JoinLobby(ws, message["data"]["lobbyId"]);
      break;
    case str_localUserLeaveLobby:
      User_LeaveLobby(ws, ws["lobbyId"], nullLobbyId);
      break;
    case str_localUserGameData:
      Lobby_UpdateTickData(ws, message["data"]);
      break;
    case str_lobbyList:
      Lobby_ListLobbies(ws);
      break;

    default:
      console.log("unknown message: " + message);
      break;
  }
}

setInterval(Lobby_SendAllTicks, 1000 / tickHertz);






function User_SendMessage(ws, jsonMessage) {
  // send a message to a user
  ws.send(JSON.stringify(jsonMessage));
}

function Lobby_SendMessage(ws, lobbyId, jsonMessage) {
  // send a message to all users in a lobby except ws
  if (lobbyId === nullLobbyId) {
    return;
  }
  for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
    var currentWs = lobbies[lobbyId]["users"][i];
    if (currentWs !== ws) {
      User_SendMessage(currentWs, jsonMessage);
    }
  }
}

function Lobby_SendMessageAll(lobbyId, jsonMessage, ws) {
  // send a message to all users in a lobby
  if (lobbyId === nullLobbyId) {
    if (null != ws) {
        User_SendMessage(ws, jsonMessage);
    } else if (verbose) {
      console.log("ws was null sendmessageall");
    }
    return;
  }
  for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
    User_SendMessage(lobbies[lobbyId]["users"][i], jsonMessage);
  }
}

function CompileUserData(ws, data, arrayOfDetails) {
  // a list of a user's data containing the keys of arrayOfDetails
  data["userId"] = ws.userId;
  for (var i=0; i<arrayOfDetails.length; i++) {
    data[arrayOfDetails[i]] = ws[arrayOfDetails[i]];
  }
}

function CompileLobbyData(lobbyId, data, arrayOfDetails) {
  // a list of a lobby's data containing the keys of arrayOfDetails
  data["lobbyId"] = lobbyId;
  for (var i=0; i<arrayOfDetails.length; i++) {
    data[arrayOfDetails[i]] = lobbies[lobbyId][arrayOfDetails[i]];
    if (arrayOfDetails[i] === "users") {
      data["users"] = [ ];
      for (var j=0; j<lobbies[lobbyId]["users"].length; j++) {
        var currentUser = lobbies[lobbyId]["users"][j];
        var userData = { };
        CompileUserData(currentUser, userData, Object.keys(userVars));
        data["users"].push(userData);
      }
    }
  }
}

function Lobby_UpdateTickData(ws, data) {
  // updates a user's tick data
  if (ws.lobbyId in lobbies) {
    lobbies[ws.lobbyId]["tickData"]["users"][ws.userId] = data;
  } else {
    console.log(ws.userId +" is still sending data");
  }
}

function Lobby_SendTick(lobbyId) {
  // sends all tick data to all users in the lobby
  var message = {
    "type": str_lobbyTickData,
    "data": lobbies[lobbyId]["tickData"]
  }

  Lobby_SendMessageAll(lobbyId, message);
}

function Lobby_SendAllTicks() {
  for (var i=0; i<multiplayerLobbies.length; i++) {
    Lobby_SendTick(multiplayerLobbies[i]);
  }
}





// User_UpdateStatus /////////////////////////////////////////////////////
function User_UpdateStatus(ws, arrayOfDetails, lobbyId) {
  // sends a user's updated details to them, which details to send are specified in arrayOfDetails //
  // lobbyId is only used when switchign lobbies //
  var message = {
    "type": str_userStatusUpdate,
    "data": { }
  }

  CompileUserData(ws, message["data"], arrayOfDetails);

  if (lobbyId == null) {
    if (verbose) {
      console.log("lobby was null");
    }
    lobbyId = ws.lobbyId;
  }

  Lobby_SendMessageAll(lobbyId, message, ws);
}

// Lobby_UpdateStatus ////////////////////////////////////////////////////
function Lobby_UpdateStatus(lobbyId, arrayOfDetails) {
  var message = {
    "type": "lobby-status",
    "data": { }
  }

  for (var i=0; i<arrayOfDetails.length; i++) {
    message["data"][arrayOfDetails[i]] = lobbies[lobbyId][arrayOfDetails[i]]
  }

  Lobby_SendMessageAll(lobbyId, message);
}

// User_Create ///////////////////////////////////////////////////////////
function User_Create(ws) {
  for (var key in userVars) {
    ws[key] = userVars[key];
  }

  ws.userId = GenerateUniqueID();

  var message = { };
  message["type"] = str_localUserInit;
  message["data"] = { };
  CompileUserData(ws, message["data"], Object.keys(userVars));

  User_SendMessage(ws, message);
}

// Lobby_Create //////////////////////////////////////////////////////////
function Lobby_Create(ws) {
  // TODO: stop lobby creation if gamemode is not player or spectator
  // TODO: tell all users in hub a new lobby was created
  var newLobbyId = GenerateUniqueID();

  lobbies[newLobbyId] = v8.deserialize(v8.serialize(lobbyVars));

  // make the user join the new lobby //
  User_JoinLobby(ws, newLobbyId);
}





function UserRemote_Join(ws) {
  var message = {
    "type": str_remoteUserJoinLobby,
    "data": { }
  }
  CompileUserData(ws, message["data"], Object.keys(userVars));
  Lobby_SendMessage(ws, ws["lobbyId"], message);
}

function UserRemote_Leave(ws, oldLobbyId) {
  var message = {
    "type": str_remoteUserLeaveLobby,
    "data": { }
  }
  message["data"]["userId"] = ws["userId"];
  Lobby_SendMessage(ws, oldLobbyId, message);
}





/////// unknown territorry ////////////////////////////////////////////////
/*
// function User_SwitchLobby(ws, oldLobbyId, newLobbyId) {
//   // TODO: send failure messages //
//   if (oldLobbyId !== nullLobbyId) {
//     if (lobbies[oldLobbyId]["users"].indexOf(ws) === -1) {
//       // user not in old lobby //
//       if (verbose) {
//         console.log("user not in old lobby");
//       }
//       return;
//     }
//     delete lobbies[oldLobbyId]["users"][ws.userId];
//   }

//   if (newLobbyId !== nullLobbyId) {
//     if (!(newLobbyId in lobbies)) {
//       // new lobby does not exist //
//       if (verbose) {
//         console.log("new lobby does not exists");
//       }
//       return;
//     }

//     if (lobbies[newLobbyId]["users"].indexOf(ws) !== -1) {
//       // user already in lobby //
//       if (verbose) {
//         console.log("user already in lobby");
//       }
//       return;
//     }

//   }

//   User_UpdateStatus(ws, ["lobby-id"], oldLobbyId);

//   if (newLobbyId !== nullLobbyId) {
//     lobbies[newLobbyId]["users"].push(ws);
//   }
//   ws.lobbyId = newLobbyId;

//   User_UpdateStatus(ws, ["lobby-id"]);
// }
*/

function User_JoinLobby(ws, lobbyId) {
  if (lobbyId === nullLobbyId) {
    return;
  }

  // see if lobby exists //
  if (!lobbies.hasOwnProperty(lobbyId)) {
    if (verbose) {
      console.log("lobby does not exist");
    }
    return;
  }

  // make sure user is not duplicated
  if (lobbies[lobbyId]["users"].indexOf(ws) > -1) {
    if (verbose) {
      console.log("user already in lobby");
    }
    return;
  }

  // see if people in current lobby need message of player leaving
  if (ws.lobbyId !== nullLobbyId) {
    User_LeaveLobby(ws, ws.lobbyId, nullLobbyId);
  }

  ws.lobbyId = lobbyId;

  var message = { };
  message["type"] = str_localUserJoinLobby;
  message["data"] = { };

  CompileLobbyData(lobbyId, message["data"], Object.keys(lobbyVars));

  // add user to lobby //
  // TODO: merge list users into same message as lobby-join
  lobbies[lobbyId]["users"].push(ws);
  lobbies[lobbyId]["tickData"]["users"][ws["userId"]] = { };

  // add the lobby to the update list //
  if (Object.keys(lobbies[lobbyId]["users"]).length === 2) {
    multiplayerLobbies.push(lobbyId);
  }

  User_SendMessage(ws, message);
  // ListUsers(ws);

  // tell other users a new user joined //
  UserRemote_Join(ws);
}

function User_LeaveLobby(ws, currentLobbyId, newLobbyId) {
  // TODO: distinguish between being kicked and disconnecting, give reasons?
  if (currentLobbyId === nullLobbyId) {
    return;
  }

  // remove user from server list //
  var index = lobbies[currentLobbyId]["users"].indexOf(ws);
  if (index > -1) {
    lobbies[currentLobbyId]["users"].splice(index, 1);
    delete lobbies[currentLobbyId]["tickData"]["users"][ws["userId"]];
    ws.lobbyId = nullLobbyId;
  } else {
    return; // user is not in lobby
  }

  // tell user they've been kicked //
  ws.lobbyId = newLobbyId;
  if (ws.connected) {
    var message = {
      "type": str_localUserLeaveLobby,
      "data": {
        "lobbyId": newLobbyId
      }
    };
    User_SendMessage(ws, message);
  }

  // remove lobby from tick update list
  if (Object.keys(lobbies[currentLobbyId]["users"]).length === 1) {
    var index = multiplayerLobbies.indexOf(currentLobbyId);
    if (index > -1) {
      multiplayerLobbies.splice(index, 1);
    }
  }

  // tell all users in the lobby that the user left //
  UserRemote_Leave(ws, currentLobbyId);

  // delete lobby if everyone left //
  if (lobbies[currentLobbyId].users.length === 0) {
    DeleteLobby(currentLobbyId);
  }
}

function DeleteLobby(lobbyId) {
  // TODO: tell users in hub that the server is no longer available
  for (var i=0; i<lobbies[lobbyId]["users"].length; i++) {
    KickUser(lobbies[lobbyId]["users"][i], lobbies[lobbyId]["users"][i].lobbyId, nullLobbyId, "lobby deleted");
  }

  delete lobbies[lobbyId];
}

function Lobby_ListLobbies(ws) {
  // TODO: also send number of players/spectators //
  var returnMessage = {
    "type": "lobby-list",
    "data": { }
  }

  for (var key in lobbies) {
    returnMessage["data"][key] = lobbies[key]["users"].length;
  }

  User_SendMessage(ws, returnMessage);
}























// create a UID ////////////////////////////////////////////////////////////////
function GenerateUniqueID() {
  // TODO: check to see if ID is truely unique //
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
}
