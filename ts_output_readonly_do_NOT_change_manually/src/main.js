var gamingPlatform;
(function (gamingPlatform) {
    var main;
    (function (main) {
        // TODO: change to your own Firebase URL! To avoid messing up the data for other students.
        // Initialize Firebase
        var config = {
            apiKey: "AIzaSyCUw1qMmgowubEhDQ6AzkK2zBjORf591do",
            authDomain: "chess-chat-f38c0.firebaseapp.com",
            databaseURL: "https://chess-chat-f38c0.firebaseio.com",
            storageBucket: "chess-chat-f38c0.appspot.com",
            messagingSenderId: "47081620857"
        };
        firebase.initializeApp(config);
        main.matches = [];
        // Saving as json because firebase has restriction on keys (and we use "data: any").
        // Example error: Firebase.set failed: First argument  contains an invalid key (playerId0.5446834512026781) in property 'matches.0.playerIdToProposal'.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
        // Another weird thing: For some reason firebase stores "{}" as null (for playerIdToProposal).
        // Some teams corrupted the data, so I changed the ref name.
        var matchesRef = firebase.database().ref("matchesJson5");
        matchesRef.on('value', function (snapshot) {
            gamingPlatform.$timeout(function () {
                var matchesJson = snapshot.val();
                gamingPlatform.log.info("matchesJson=", matchesJson);
                if (!matchesJson) {
                    main.matches = createCommunityMatches();
                    storeMatches();
                }
                else {
                    main.matches = angular.fromJson(matchesJson);
                    if (showGameIframe())
                        sendCommunityUI();
                }
            });
        });
        main.indexToChatMsgs = [];
        var chatRef = firebase.database().ref("indexToChatMsgs");
        chatRef.on('value', function (snapshot) {
            gamingPlatform.$timeout(function () {
                main.indexToChatMsgs = snapshot.val();
                gamingPlatform.log.info("indexToChatMsgs=", main.indexToChatMsgs);
                if (!main.indexToChatMsgs)
                    main.indexToChatMsgs = [];
            });
        });
        function getChatMsgs() {
            return main.indexToChatMsgs[currentMatchIndex] ? main.indexToChatMsgs[currentMatchIndex] : [];
        }
        main.getChatMsgs = getChatMsgs;
        main.myCommunityPlayerIndex = location.search.indexOf('playBlack') != -1 ? 0 :
            location.search.indexOf('playWhite') != -1 ? 1 :
                Math.random() > 0.5 ? 0 : 1;
        main.myPlayerInfo = location.protocol == "file:" ? {
            avatarImageUrl: "http://graph.facebook.com/10154287448416125/picture?square=square",
            displayName: "Test player " + Math.floor(1000 * Math.random()),
            playerId: "playerId" + Math.random()
        } : null;
        function storeMatches() {
            matchesRef.set(angular.toJson(main.matches));
        }
        function storeChat() {
            chatRef.set(main.indexToChatMsgs);
        }
        function createCommunityMatches() {
            return [
                createCommunityMatch("Greendale"),
                createCommunityMatch("Walla Walla"),
                createCommunityMatch("Santa Barbara"),
                createCommunityMatch("Valencia"),
            ];
        }
        function createCommunityMatch(matchName) {
            return {
                matchName: matchName,
                numberOfPlayers: 2,
                stateBeforeMove: null,
                turnIndexBeforeMove: 0,
                move: {
                    endMatchScores: null,
                    turnIndexAfterMove: 0,
                    stateAfterMove: null,
                },
                playerIdToProposal: {},
            };
        }
        function isInPage(page) {
            if (page.charAt(0) !== '/') {
                throw new Error("page must start with '/', but got page=" + page);
            }
            return location.hash.indexOf('#' + page) === 0;
        }
        main.isInPage = isInPage;
        function isInPagePlayGame() {
            return isInPage("/playGame/");
        }
        function showGameIframe() {
            return isInPagePlayGame() && gamingPlatform.messageSender.didGetGameReady();
        }
        main.showGameIframe = showGameIframe;
        function changePage(hash) {
            var currentLocation = location.hash.substring(1); // to remove "#"
            gamingPlatform.log.info("changePage from " + currentLocation + " to " + hash);
            if (currentLocation === hash) {
                return;
            }
            gamingPlatform.$location.path(hash);
            window.scrollTo(0, 0);
        }
        main.changePage = changePage;
        function gotoPlayPage(matchIndex) {
            changePage('/playGame/' + matchIndex);
        }
        main.gotoPlayPage = gotoPlayPage;
        function gotoMainPage() {
            changePage('/main');
        }
        main.gotoMainPage = gotoMainPage;
        main.chatMessage = "";
        function sendChat() {
            addChatMsg({ chat: main.chatMessage, fromPlayer: main.myPlayerInfo });
            main.chatMessage = "";
        }
        main.sendChat = sendChat;
        function addChatMsg(chatMsg) {
            if (!main.indexToChatMsgs[currentMatchIndex])
                main.indexToChatMsgs[currentMatchIndex] = [];
            var chatMsgs = main.indexToChatMsgs[currentMatchIndex];
            chatMsgs.unshift(chatMsg);
            if (chatMsgs.length > 100)
                chatMsgs.pop();
            storeChat();
        }
        main.isChatShowing = false;
        function toggleChat() {
            main.isChatShowing = !main.isChatShowing;
        }
        main.toggleChat = toggleChat;
        function isYourTurn(match) {
            return match.move.turnIndexAfterMove == main.myCommunityPlayerIndex &&
                !match.playerIdToProposal[main.myPlayerInfo.playerId];
        }
        main.isYourTurn = isYourTurn;
        var currentMatchIndex = null;
        function getCurrentMatch() {
            return main.matches[currentMatchIndex];
        }
        main.getCurrentMatch = getCurrentMatch;
        function loadMatch(matchIndex) {
            var match = main.matches[matchIndex];
            if (!match || !main.myPlayerInfo) {
                gamingPlatform.log.warn("Couldn't find matchIndex=", matchIndex);
                changePage('/main');
                return;
            }
            currentMatchIndex = matchIndex;
            sendCommunityUI();
        }
        main.loadMatch = loadMatch;
        var lastCommunityUI = null;
        function sendCommunityUI() {
            var match = main.matches[currentMatchIndex];
            var communityUI = {
                yourPlayerIndex: main.myCommunityPlayerIndex,
                yourPlayerInfo: main.myPlayerInfo,
                playerIdToProposal: match.playerIdToProposal,
                numberOfPlayers: match.numberOfPlayers,
                stateBeforeMove: match.stateBeforeMove,
                turnIndexBeforeMove: match.turnIndexBeforeMove,
                move: match.move,
            };
            gamingPlatform.log.info("sendCommunityUI: ", communityUI);
            lastCommunityUI = communityUI;
            gamingPlatform.messageSender.sendToGame({ communityUI: communityUI });
        }
        window.addEventListener("message", function (event) {
            var game_iframe = window.document.getElementById("game_iframe");
            if (!game_iframe || game_iframe.contentWindow !== event.source) {
                return;
            }
            gamingPlatform.$rootScope.$apply(function () {
                var message = event.data;
                gamingPlatform.log.info("Platform got message:", message);
                if (message.gameReady) {
                    if (gamingPlatform.messageSender.didGetGameReady()) {
                        gamingPlatform.log.warn("Game sent gameReady before (look at the logs)! You can only send gameReady once.");
                        return;
                    }
                    gamingPlatform.messageSender.gotGameReady();
                    return;
                }
                // {communityMove: { proposal: proposal, move: move, lastCommunityUI: lastCommunityUI }
                var communityMove = message.communityMove;
                if (!communityMove) {
                    gamingPlatform.log.info("Not a communityMove!");
                    return;
                }
                if (!angular.equals(communityMove.lastCommunityUI, lastCommunityUI)) {
                    gamingPlatform.log.error("This move belongs to an old communityUI! lastCommunityUI=\n" +
                        angular.toJson(lastCommunityUI, true) + " communityMove.lastCommunityUI=\n" +
                        angular.toJson(communityMove.lastCommunityUI, true));
                    return;
                }
                var proposal = communityMove.proposal;
                var move = communityMove.move;
                var match = main.matches[currentMatchIndex];
                var chatMsg = { chat: "Played the move: " + proposal.chatDescription, fromPlayer: proposal.playerInfo };
                addChatMsg(chatMsg);
                if (move) {
                    match.turnIndexBeforeMove = match.move.turnIndexAfterMove;
                    match.stateBeforeMove = match.move.stateAfterMove;
                    match.playerIdToProposal = {};
                    match.move = move;
                }
                else {
                    match.playerIdToProposal[main.myPlayerInfo.playerId] = proposal;
                }
                storeMatches();
                sendCommunityUI();
            });
        });
        function googleLogin() {
            var provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/plus.login');
            firebase.auth().signInWithPopup(provider).then(function (result) {
                // This gives you a Google Access Token. You can use it to access the Google API.
                var token = result.credential.accessToken;
                // The signed-in user info.
                var user = result.user;
                gamingPlatform.log.info("Google login succeeded: ", token, user);
            }).catch(function (error) {
                gamingPlatform.log.error("Google login failed: ", error);
            });
        }
        main.googleLogin = googleLogin;
        firebase.auth().onAuthStateChanged(function (user) {
            if (!user)
                return;
            // User is signed in.
            main.myPlayerInfo = {
                avatarImageUrl: user.photoURL,
                displayName: user.displayName,
                playerId: user.uid,
            };
            gamingPlatform.log.alwaysLog("myPlayerInfo=", main.myPlayerInfo);
            if (gamingPlatform.$rootScope)
                gamingPlatform.$rootScope.$apply();
        });
        angular.module('MyApp', ['ngMaterial', 'ngRoute'])
            .config(['$routeProvider', function ($routeProvider) {
                $routeProvider.
                    when('/main', {
                    templateUrl: 'html-templates/mainPage.html',
                    controller: ''
                }).
                    when('/playGame/:matchIndex', {
                    templateUrl: 'html-templates/playPage.html',
                    controller: 'PlayGameCtrl'
                }).
                    otherwise({
                    redirectTo: '/main'
                });
            }])
            .controller('PlayGameCtrl', ['$routeParams',
            function ($routeParams) {
                var matchIndex = $routeParams["matchIndex"];
                gamingPlatform.log.info("PlayGameCtrl matchIndex=", matchIndex);
                loadMatch(matchIndex);
            }])
            .run([
            '$timeout', '$interval',
            '$interpolate',
            '$http',
            '$location',
            '$rootScope',
            '$route',
            '$sce',
            '$templateCache',
            function (_timeout, _interval, _interpolate, _http, _location, _rootScope, _route, _sce, _templateCache) {
                if (_templateCache.get('html-templates/mainPage.html')) {
                    gamingPlatform.log.error("Missing html-templates/mainPage.html in $templateCache");
                }
                gamingPlatform.$timeout = _timeout;
                gamingPlatform.$interval = _interval;
                gamingPlatform.$interpolate = _interpolate;
                gamingPlatform.$http = _http;
                gamingPlatform.$location = _location;
                gamingPlatform.$rootScope = _rootScope;
                gamingPlatform.$route = _route;
                gamingPlatform.$sce = _sce; // It's module-specific, or else I get: Error: [$sce:unsafe] Attempting to use an unsafe value in a safe context.
                gamingPlatform.log.alwaysLog("Angular loaded!");
                gamingPlatform.$rootScope['main'] = main;
            }]);
    })(main = gamingPlatform.main || (gamingPlatform.main = {}));
})(gamingPlatform || (gamingPlatform = {}));
//# sourceMappingURL=main.js.map