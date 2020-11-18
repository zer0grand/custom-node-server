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




const socket = new WebSocket('ws://' + location.host);

var localUserData = { };
var remoteUserData = { };

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
    switch(message["type"]) {
        case str_localUserInit:
            localUserData = message["data"];
            Display_CreateHeaders(localUserData);
            UpdateLocalUserData(message["data"]);

            GF_ConnectionInit();
            break;

        case str_userStatusUpdate:
            if (message["data"]["userId"] === localUserData["userId"]) {
                UpdateLocalUserData(message["data"]);
            }

            GF_LocalUserDataUpdate(message["data"]);
            break;

        case str_localUserJoinLobby:
            localUserData["lobbyId"] = message["data"]["lobbyId"];
            Display_UpdateLocalUserData();

            console.log(message["data"]["userData"]);


            for (var i=0; i<message["data"]["users"].length; i++) {
                Display_CreateRemoteUser(message["data"]["users"][i]);
            }

            GF_LocalUserJoinLobby();
            break;

        case str_localUserLeaveLobby:
            UpdateLocalUserData(message["data"]);
            Display_ClearRemoteUsers();

            GF_LocalUserLeaveLobby();
            break;

        case str_remoteUserJoinLobby:
            // add user to remoteuserdata
            Display_CreateRemoteUser(message["data"]);

            GF_RemoteUserJoinLobby();
            break;

        case str_remoteUserLeaveLobby:
            Display_RemoveRemoteUser(message["data"]["userId"]);

            GF_RemoteUserLeaveLobby();
            break;

        case str_lobbyTickData:
            Display_UpdateTickData(message["data"]);
            break;

        // case "user-joined-lobby":




        // case "user-details":
        //     localUserId = message["data"]["user-id"];
        //     localUserName = message["data"]["user-name"];
        //     localLobbyId = message["data"]["lobby-id"];
        //     localGamemode = message["data"]["gamemode"];

        //     UpdateLocalUserInfo();

        //     socket.send(JSON.stringify({
        //         "type": "switch-gamemode",
        //         "data": {
        //             "gamemode": "player"
        //         }
        //     }));
        //     break;
        // case "success":
        //     InterpretMessageSuccess(message.data);
        //     break;
        // case "lobby-list":
        //     for (var i=0; i<message["data"]["lobbies"].length; i++) {
        //         PopulateServerLobbies(message["data"]["lobbies"][i]);
        //     }
        //     break;
        // case "user-list":
        //     for (var i=0; i<message["data"].length; i++) {
        //         PopulateLobbyUsers(message["data"][i]);
        //     }
        //     break;
        // case "user-update":
        //     console.log(message);
        //     UpdateUserInfo(message["data"]);
        //     break;
        // case "lobby-update":
        //     UpdateLobbyTable(message["data"]);
        //     break;
        // case "kicked-from-lobby":
        //     console.log("left lobby");
        //     localLobbyId = message["data"]["new-lobby"];
        //     UpdateLocalUserInfo();
        //     ClearLobbyUsers();
        //     break;
        // case "user-joined":
        //     PopulateLobbyUsers(message["data"]);
        //     break;
        // case "user-left":
        //     DePopulateLobbyUsers(message["data"]);
        //     break;
        // case "user-message":
        //     InterpretUserMessage(message["data"]);
        //     break;

        default:
            console.log("unknown message: ");
            console.log(message);
            break;
    }
}

function CreateLobby() {
    socket.send(JSON.stringify({
        "type": str_localUserCreateLobby
    }));
}

function JoinLobby() {
    var lobbyId = joinLobbyText.value;
    socket.send(JSON.stringify({
        "type": str_localUserJoinLobby,
        "data": {
            "lobbyId": lobbyId
        }
    }));
}

function LeaveLobby() {
    socket.send(JSON.stringify({
        "type": str_localUserLeaveLobby
    }))
}

function ListLobbies() {
    socket.send(JSON.stringify({
        "type": str_lobbyList
    }))
}



// helper functions
function UpdateLocalUserData(data) {
    for (key in data) {
        localUserData[key] = data[key];
    }
    Display_UpdateLocalUserData();
}







// example functions for non dummy clients (Game Functions)

function GF_ConnectionInit() {
    console.log("connection established");
}

function GF_LocalUserDataUpdate(data) {
    console.log("local user data update:");
    console.log(data);
}

function GF_LocalUserJoinLobby() {
    console.log("joined lobby " + localUserData["lobbyId"]);
}

function GF_LocalUserLeaveLobby() {
    console.log("left lobby");
}

function GF_RemoteUserJoinLobby() {
    console.log("a user joined the lobby");
}

function GF_RemoteUserLeaveLobby() {
    console.log("a user left the lobby");
}



// updating UI
// general
function Display_CreateHeaders(data) {
    var tr = document.createElement("tr");

    for (key in data) {
        var th = document.createElement("th");
        th.innerText = key;

        tr.appendChild(th);
    }

    localUserDataTable.innerHTML = "";
    localUserDataTable.appendChild(tr);

    remoteUserDataTable.innerHTML = "";
    remoteUserDataTable.appendChild(tr.cloneNode(true));
}

// local user
function Display_UpdateLocalUserData() {
    console.log("display");
    var tr = document.createElement("tr");

    for (key in localUserData) {
        var td = document.createElement("td");
        if (typeof localUserData[key] === "object") {
            td.innerText = JSON.stringify(localUserData[key]);
        } else {
            td.innerText = localUserData[key];
        }

        tr.appendChild(td);
    }

    if (localUserDataTable.children.length > 1) {
        localUserDataTable.children[1].remove();
    }
    localUserDataTable.appendChild(tr);
}

// remote user
function Display_CreateRemoteUser(data) {
    var tr = document.createElement("tr");
    tr.id = "user-"+ data["userId"];
    console.log(tr.id);

    for (key in data) {
        var td = document.createElement("td");
        td.id = "user-"+ data["userId"] +"-"+ key;
        if (typeof data[key] === "object") {
            td.innerText = JSON.stringify(data[key]);
        } else {
            td.innerText = data[key];
        }

        tr.appendChild(td);
    }

    remoteUserDataTable.appendChild(tr);
}

function Display_UpdateRemoteUserData(userId) {
    // var tr = document.createElement("tr");

    // for (key in remoteUserData[userId]) {
    //     var th = document.createElement("th");
    //     th.innerText = key;
    //     var td = document.createElement("td");
    //     if (typeof localUserData[key] === "object") {
    //         td.innerText = JSON.stringify(localUserData[key]);
    //     } else {
    //         td.innerText = localUserData[key];
    //     }

    //     tr.appendChild(th);
    // }

    // localUserDataTable.innerHTML = "";
    // localUserDataTable.appendChild(tr);
}

function Display_RemoveRemoteUser(userId) {
    document.getElementById("user-"+ userId).remove();
}

function Display_ClearRemoteUsers() {
    for (var i=0; i<remoteUserDataTable.children.length; i++) {
        remoteUserDataTable.children[1].remove();
    }
}









function Display_UpdateTickData(data) {
    // user-8fd225a0-72c1-gameData
    for (var key in data["users"]) {
        if (key === localUserData["userId"]) {
            continue;
        }
        document.getElementById("user-"+ key +"-gameData").innerText = JSON.stringify(data["users"][key]);
    }
}













// function InterpretMessageSuccess(data) {
//     switch (data["request"]) {
//         case "switch-gamemode":
//             if (data["success-message"] === "player") {
//                 localGamemode = "player";
//                 UpdateLocalUserInfo();
//                 // GetUsers();
//                 GetLobbies();
//             }
//             break;
//         case "create-lobby":
//             console.log("created lobby");
//             break;
//         case "join-lobby":
//             console.log("joined lobby");
//             localLobbyId = data["success-message"];
//             UpdateLocalUserInfo();
//             break;
//         }
// }

// function UpdateLobbyTable(data) {
//     switch (data["status"]) {
//         case "created":
//             PopulateServerLobbies(data["lobby-id"]);
//             break;
//         case "deleted":
//             console.log(data);
//             DePopulateServerLobbies(data["lobby-id"]);
//             break;
//     }
// }

// function GetLobbies() {
//     ClearLobbies();
//     var message = {
//         "type": "list-lobbies"
//     }
//     socket.send(JSON.stringify(message));
// }

// function ClearLobbies() {
//     for (var i=0; i<serverLobbyTable.childElementCount-1; i--) {
//         serverLobbyTable.childNodes[1].remove();
//     }
// }

// // function GetUsers() {
// //     ClearUsers();
// //     var message = {
// //         "type": "list-users"
// //     }
// //     socket.send(JSON.stringify(message));
// // }

// function ClearUsers() {
//     for (var i=0; i<serverLobbyTable.childElementCount-1; i--) {
//         serverLobbyTable.childNodes[1].remove();
//     }
// }

// function UpdateUserInfo(data) {
//     var el = document.getElementById("users-" + data["user-id"]);
//     el.childNodes[0].innerText = data["user-id"];
//     el.childNodes[1].innerText = data["user-name"];
//     el.childNodes[2].innerText = data["lobby-id"];
//     el.childNodes[3].innerText = data["gamemode"];
// }

// function UpdateLocalUserInfo() {
//     elUserId.innerText = localUserId;
//     elUserName.innerText = localUserName;
//     elLobbyId.innerText = localLobbyId;
//     elGamemode.innerText = localGamemode;
// }

// function PopulateServerLobbies(data) {
//     var newLobby = document.createElement("tr");
//     newLobby.classList += "lobby";
//     newLobby.id = "lobby-"+ data;
//     newLobby.onclick = function() {
//         JoinLobby(data);
//     }
//     var newLobbyInner = document.createElement("td");
//     newLobbyInner.innerText = data;

//     newLobby.appendChild(newLobbyInner);
//     serverLobbyTable.appendChild(newLobby);
// }

// function DePopulateServerLobbies(data) {
//     console.log("lobby-" + data)
//     var el = document.getElementById("lobby-" + data);
//     el.remove();
// }


// function PopulateLobbyUsers(data) {
//     var newUser = document.createElement("tr");
//     newUser.id = "user-"+ data["user-id"];

//     var newUserId = document.createElement("td");
//     newUserId.innerText = data["user-id"];
//     var newUserName = document.createElement("td");
//     newUserName.innerText = data["user-name"];
//     var newGamemode = document.createElement("td");
//     newGamemode.innerText = data["gamemode"];
//     var newDataRelay = document.createElement("td");
//     newDataRelay.id = "relay-"+ data["user-id"];

//     newUser.appendChild(newUserId);
//     newUser.appendChild(newUserName);
//     newUser.appendChild(newGamemode);
//     newUser.appendChild(newDataRelay);

//     usersInfoTable.appendChild(newUser);
// }

// function DePopulateLobbyUsers(data) {
//     var el = document.getElementById("user-"+ data["user-id"]);
//     el.remove();
// }

// function ClearLobbyUsers() {
//     console.log(usersInfoTable.childElementCount +" "+ usersInfoTable.childNodes.lengthc);
//     for (var i=0; i<usersInfoTable.childElementCount-1; i++) {
//         usersInfoTable.childNodes[3].remove();
//     }
// }

// function InterpretUserMessage(data) {
//     document.getElementById("relay-"+ data["user-id"]).innerText = JSON.stringify(data["data"], null, 2);
// }





// function CreateLobby() {
//     socket.send(JSON.stringify({
//         "type": "create-lobby"
//     }));
// }

// function JoinLobby(lobbyId) {
//     socket.send(JSON.stringify({
//         "type": "join-lobby",
//         "data": {
//             "lobby-id": lobbyId
//         }
//     }));
// }

// function LeaveLobby() {
//     socket.send(JSON.stringify({
//         "type": "leave-lobby"
//     }));
// }

function SendData() { 
    var data = JSON.parse(userGameData.value);
    socket.send(JSON.stringify({
        "type": str_localUserGameData,
        "data": data
    }));
}