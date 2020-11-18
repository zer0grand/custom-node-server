const socket = new WebSocket('ws://' + location.host);

var localUserId;
var localUserName;
var localLobbyId;
var localGamemode;

var verbose;

socket.addEventListener('open', function (e) {
    userConnectionStatus.innerText = "connected";
    userConnectionStatus.style.color = "green";
});

socket.addEventListener('close', function (e) {
    userConnectionStatus.innerText = "disconnected";
    userConnectionStatus.style.color = "red";
});

socket.addEventListener('message', function (e) {
    if (verbose) {
        console.log("socket message: " + e.data);
    }
    var message = JSON.parse(e.data);
    InterpretMessage(message);
})

function InterpretMessage(message) {
    console.log("message "+ message["type"]);
    switch(message["type"]) {
        case "user-details":
            localUserId = message["data"]["user-id"];
            localUserName = message["data"]["user-name"];
            localLobbyId = message["data"]["lobby-id"];
            localGamemode = message["data"]["gamemode"];

            UpdateLocalUserInfo();

            socket.send(JSON.stringify({
                "type": "switch-gamemode",
                "data": {
                    "gamemode": "server"
                }
            }));
            break;
        case "success":
            InterpretMessageSuccess(message.data);
            break;
        case "lobby-list":
            for (var i=0; i<message["data"]["lobbies"].length; i++) {
                PopulateServerLobbies(message["data"]["lobbies"][i]);
            }
            break;
        case "user-list":
            for (var i=0; i<message["data"].length; i++) {
                PopulateServerInfo(message["data"][i]);
            }
            break;
        case "user-joined-server":
            PopulateServerInfo(message["data"]);
            break;
        case "user-left-server":
            DePopulateServerInfo(message["data"]);
            break;
        case "user-update":
            console.log(message);
            UpdateUserInfo(message["data"]);
            break;
        case "lobby-update":
            UpdateLobbyTable(message["data"]);
            break;

        default:
            console.log("unknown message: ");
            console.log(message);
            break;
    }
}

function InterpretMessageSuccess(data) {
    switch (data["request"]) {
        case "switch-gamemode":
            if (data["success-message"] === "server") {
                localGamemode = "server";
                UpdateLocalUserInfo();
                GetUsers();
                GetLobbies();
            }
            break;
    }
}

function UpdateLobbyTable(data) {
    switch (data["status"]) {
        case "created":
            PopulateServerLobbies(data["lobby-id"]);
            break;
        case "deleted":
            DePopulateServerLobbies(data["lobby-id"]);
            break;
    }
}

function GetLobbies() {
    ClearLobbies();
    var message = {
        "type": "list-lobbies"
    }
    socket.send(JSON.stringify(message));
}

function ClearLobbies() {
    for (var i=0; i<serverLobbyTable.childElementCount-1; i--) {
        serverLobbyTable.childNodes[1].remove();
    }
}

function GetUsers() {
    ClearUsers();
    var message = {
        "type": "list-users"
    }
    socket.send(JSON.stringify(message));
}

function ClearUsers() {
    for (var i=0; i<serverLobbyTable.childElementCount-1; i--) {
        serverLobbyTable.childNodes[1].remove();
    }
}

function UpdateUserInfo(data) {
    var el = document.getElementById("users-" + data["user-id"]);
    el.childNodes[0].innerText = data["user-id"];
    el.childNodes[1].innerText = data["user-name"];
    el.childNodes[2].innerText = data["lobby-id"];
    el.childNodes[3].innerText = data["gamemode"];
}

function UpdateLocalUserInfo() {
    elUserId.innerText = localUserId;
    elUserName.innerText = localUserName;
    elLobbyId.innerText = localLobbyId;
    elGamemode.innerText = localGamemode;
}

function PopulateServerLobbies(data) {
    var newLobby = document.createElement("tr");
    newLobby.id = "lobby-"+ data;
    var newLobbyInner = document.createElement("td");
    newLobbyInner.innerText = data;

    newLobby.appendChild(newLobbyInner);
    serverLobbyTable.appendChild(newLobby);
}

function DePopulateServerLobbies(data) {
    var el = document.getElementById("lobby-" + data);
    el.remove();
}

function PopulateServerInfo(data) {
    // unsanitized version /////////////////////////
    // serverInfoTable.innerHTML += '\
    // <tr id="users-'+ data[i]["user-id"] +'">\
    //     <td>'+ data[i]["user-id"] +'</td>\
    //     <td>'+ data[i]["user-name"] +'</td>\
    //     <td>'+ data[i]["lobby-id"] +'</td>\
    //     <td>'+ data[i]["gamemode"] +'</td>\
    // </tr>\
    // ';

    // probably sanitized version /////////////////////////
    var elTable = document.createElement("tr");
    elTable.id = "users-" + data["user-id"];

    var elUserId = document.createElement("td");
    elUserId.innerText = data["user-id"];
    var elUserName = document.createElement("td");
    elUserName.innerText = data["user-name"];
    var elLobbyId = document.createElement("td");
    elLobbyId.innerText = data["lobby-id"];
    var elGamemode = document.createElement("td");
    elGamemode.innerText = data["gamemode"];

    if (localUserId === data["user-id"]) {
        elTable.style.color = "blue";
    }

    elTable.appendChild(elUserId);
    elTable.appendChild(elUserName);
    elTable.appendChild(elLobbyId);
    elTable.appendChild(elGamemode);
    
    serverInfoTable.appendChild(elTable);
}

function DePopulateServerInfo(data) {
    var el = document.getElementById("users-" + data["user-id"]);
    el.remove();
}