const socket = new WebSocket('ws://' + location.host);

var localUserId;
var localUserName;
var localLobbyId;
var localGamemode;

socket.addEventListener('open', function (e) {
    userConnectionStatus.innerText = "connected";
    userConnectionStatus.style.color = "green";
});

socket.addEventListener('close', function (e) {
    userConnectionStatus.innerText = "disconnected";
    userConnectionStatus.style.color = "red";
});

socket.addEventListener('message', function (e) {
    var message = JSON.parse(e.data);
    InterpretMessage(message);
})

function InterpretMessage(message) {
    // console.log("message "+ message["type"]);
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
                    "gamemode": "player"
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
                PopulateLobbyUsers(message["data"][i]);
            }
            break;
        case "user-update":
            console.log(message);
            UpdateUserInfo(message["data"]);
            break;
        case "lobby-update":
            UpdateLobbyTable(message["data"]);
            break;
        case "kicked-from-lobby":
            console.log("left lobby");
            localLobbyId = message["data"]["new-lobby"];
            UpdateLocalUserInfo();
            ClearLobbyUsers();
            break;
        case "user-joined":
            PopulateLobbyUsers(message["data"]);
            break;
        case "user-left":
            DePopulateLobbyUsers(message["data"]);
            break;
        case "user-message":
            InterpretUserMessage(message["data"]);
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
            if (data["success-message"] === "player") {
                localGamemode = "player";
                UpdateLocalUserInfo();
                // GetUsers();
                GetLobbies();
            }
            break;
        case "create-lobby":
            console.log("created lobby");
            break;
        case "join-lobby":
            console.log("joined lobby");
            localLobbyId = data["success-message"];
            UpdateLocalUserInfo();
            break;
        }
}

function UpdateLobbyTable(data) {
    switch (data["status"]) {
        case "created":
            PopulateServerLobbies(data["lobby-id"]);
            break;
        case "deleted":
            console.log(data);
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

// function GetUsers() {
//     ClearUsers();
//     var message = {
//         "type": "list-users"
//     }
//     socket.send(JSON.stringify(message));
// }

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
    newLobby.classList += "lobby";
    newLobby.id = "lobby-"+ data;
    newLobby.onclick = function() {
        JoinLobby(data);
    }
    var newLobbyInner = document.createElement("td");
    newLobbyInner.innerText = data;

    newLobby.appendChild(newLobbyInner);
    serverLobbyTable.appendChild(newLobby);
}

function DePopulateServerLobbies(data) {
    console.log("lobby-" + data)
    var el = document.getElementById("lobby-" + data);
    el.remove();
}


function PopulateLobbyUsers(data) {
    var newUser = document.createElement("tr");
    newUser.id = "user-"+ data["user-id"];

    var newUserId = document.createElement("td");
    newUserId.innerText = data["user-id"];
    var newUserName = document.createElement("td");
    newUserName.innerText = data["user-name"];
    var newGamemode = document.createElement("td");
    newGamemode.innerText = data["gamemode"];
    var newDataRelay = document.createElement("td");
    newDataRelay.id = "relay-"+ data["user-id"];

    newUser.appendChild(newUserId);
    newUser.appendChild(newUserName);
    newUser.appendChild(newGamemode);
    newUser.appendChild(newDataRelay);

    usersInfoTable.appendChild(newUser);
}

function DePopulateLobbyUsers(data) {
    var el = document.getElementById("user-"+ data["user-id"]);
    el.remove();
}

function ClearLobbyUsers() {
    console.log(usersInfoTable.childElementCount +" "+ usersInfoTable.childNodes.lengthc);
    for (var i=0; i<usersInfoTable.childElementCount-1; i++) {
        usersInfoTable.childNodes[3].remove();
    }
}

function InterpretUserMessage(data) {
    document.getElementById("relay-"+ data["user-id"]).innerText = JSON.stringify(data["data"], null, 2);
}





function CreateLobby() {
    socket.send(JSON.stringify({
        "type": "create-lobby"
    }));
}

function JoinLobby(lobbyId) {
    socket.send(JSON.stringify({
        "type": "join-lobby",
        "data": {
            "lobby-id": lobbyId
        }
    }));
}

function LeaveLobby() {
    socket.send(JSON.stringify({
        "type": "leave-lobby"
    }));
}

function SendData() { 
    var data = JSON.parse(relayData.value);
    socket.send(JSON.stringify({
        "type": "user-message",
        "data": data
    }));
}