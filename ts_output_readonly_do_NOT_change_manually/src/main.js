var gamingPlatform;
(function (gamingPlatform) {
    var main;
    (function (main) {
        // Feel free to change to your own Firebase URL :)
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
        var matchesRef = firebase.database().ref("matchesJson");
        matchesRef.on('value', function (snapshot) {
            gamingPlatform.$timeout(function () {
                var matchesJson = snapshot.val();
                console.log(matchesJson);
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
        main.communityChat = getChatData();
        main.myPlayerInfo = getMyPlayerInfo();
        gamingPlatform.log.alwaysLog("myPlayerInfo=", main.myPlayerInfo);
        function getMyPlayerInfo() {
            var myPlayerInfoJson = localStorage.getItem("myPlayerInfoJson");
            if (myPlayerInfoJson)
                return angular.fromJson(myPlayerInfoJson);
            main.myPlayerInfo = {
                avatarImageUrl: "http://graph.facebook.com/10154287448416125/picture?square=square",
                displayName: "Guest player " + (1 + Math.floor(999 * Math.random())),
                myCommunityPlayerIndex: location.search.indexOf('playBlack') != -1 ? 0 :
                    location.search.indexOf('playWhite') != -1 ? 1 :
                        Math.random() > 0.5 ? 0 : 1,
                playerId: "playerId" + Math.floor(1000000 * Math.random()),
            };
            localStorage.setItem("myPlayerInfoJson", angular.toJson(main.myPlayerInfo));
            return main.myPlayerInfo;
        }
        function getChatData() {
            main.communityChat = {
                messageList: document.getElementById('messages'),
                messageForm: document.getElementById('message-form'),
                messageInput: document.getElementById('message'),
                submitButton: document.getElementById('submit'),
                submitImageButton: document.getElementById('submitImage'),
                imageForm: document.getElementById('image-form'),
                mediaCapture: document.getElementById('mediaCapture'),
                userPic: document.getElementById('user-pic'),
                userName: document.getElementById('user-name'),
                signInButton: document.getElementById('sign-in'),
                signOutButton: document.getElementById('sign-out'),
                signInSnackbar: document.getElementById('must-signin-snackbar'),
            };
            return main.communityChat;
        }
        function storeMatches() {
            matchesRef.set(angular.toJson(main.matches));
        }
        function createCommunityMatches() {
            return [
                createCommunityMatch("Greendale"),
                createCommunityMatch("Walla Walla"),
                createCommunityMatch("Santa Barbara"),
                createCommunityMatch("Valencia")
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
        function isYourTurn(match) {
            return match.move.turnIndexAfterMove == main.myPlayerInfo.myCommunityPlayerIndex &&
                !match.playerIdToProposal[main.myPlayerInfo.playerId];
        }
        main.isYourTurn = isYourTurn;
        var currentMatchIndex = null;
        function loadMatch(matchIndex) {
            var match = main.matches[matchIndex];
            if (!match) {
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
                yourPlayerIndex: main.myPlayerInfo.myCommunityPlayerIndex,
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
                // TODO: add proposal.chatDescription + proposal.playerInfo (avatar+displayName) to the group chat.
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