namespace gamingPlatform {
  interface IMove {
  endMatchScores: number[];
  turnIndexAfterMove: number;
  stateAfterMove: any;
}
interface IStateTransition {
  turnIndexBeforeMove : number;
  stateBeforeMove: any;
  numberOfPlayers: number;
  move: IMove;
}
interface IPlayerInfo {
  avatarImageUrl: string;
  displayName: string;
  playerId: string;
}
interface ICommonUI extends IStateTransition {
  // -2 is a viewer; otherwise it's the player index (0/1).
  yourPlayerIndex: number;
}
// Proposals are used in community games: each player may submit a proposal, and the game will eventual selected
// the winning proposal and convert it to a move.
interface ICommunityUI extends ICommonUI {
  // You need to know your playerId to make sure you only make one proposal,
  // i.e., if (playerIdToProposal[yourPlayerId]) then you can't make another proposal.
  yourPlayerInfo: IPlayerInfo; 
  // Mapping playerId to his proposal.
  playerIdToProposal: IProposals; 
}
interface IProposal {
  playerInfo: IPlayerInfo; // the player making the proposal.
  chatDescription: string; // string representation of the proposal that will be shown in the community game chat.
  data: any; // IProposalData must be defined by the game.
}
interface IProposals {
  [playerId: string]: IProposal;
}

interface ICommunityMatch extends IStateTransition {
  matchName: string;
  playerIdToProposal: IProposals; 
}
interface ChatMsg {
  chat: string;
  fromPlayer: IPlayerInfo;
}

export let $rootScope: angular.IScope;
export let $location: angular.ILocationService;
export let $timeout: angular.ITimeoutService;
export let $interval: angular.IIntervalService;
export let $sce: angular.ISCEService;
export let $interpolate: angular.IInterpolateService;
export let $http: angular.IHttpService;
export let $route: angular.route.IRouteService;

declare var firebase: any;

export module main {
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
  export let matches: ICommunityMatch[] = [];
  // Saving as json because firebase has restriction on keys (and we use "data: any").
  // Example error: Firebase.set failed: First argument  contains an invalid key (playerId0.5446834512026781) in property 'matches.0.playerIdToProposal'.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
  // Another weird thing: For some reason firebase stores "{}" as null (for playerIdToProposal).
  // Some teams corrupted the data, so I changed the ref name.
  let matchesRef = firebase.database().ref("matchesJson5");
  matchesRef.on('value', function(snapshot: any) {
    $timeout(()=> {
      let matchesJson = snapshot.val();
      log.info("matchesJson=", matchesJson);
      if (!matchesJson) {
        matches = createCommunityMatches(); 
        storeMatches();
      } else {
        matches = angular.fromJson(matchesJson);
        if (showGameIframe()) sendCommunityUI();
      }
    });
  });

  export let indexToChatMsgs: ChatMsg[][] = [];
  let chatRef = firebase.database().ref("indexToChatMsgs");
  chatRef.on('value', function(snapshot: any) {
    $timeout(()=> {
      indexToChatMsgs = snapshot.val();
      log.info("indexToChatMsgs=", indexToChatMsgs);
      if (!indexToChatMsgs) indexToChatMsgs = [];
    });
  });

  export function getChatMsgs() {
    return indexToChatMsgs[currentMatchIndex] ? indexToChatMsgs[currentMatchIndex] : [];
  }

  export let myCommunityPlayerIndex = location.search.indexOf('playBlack') != -1 ? 0 :
        location.search.indexOf('playWhite') != -1 ? 1 : 
        Math.random() > 0.5 ? 0 : 1;

  export let myPlayerInfo: IPlayerInfo = location.protocol == "file:" ? {
    avatarImageUrl: "http://graph.facebook.com/10154287448416125/picture?square=square",
    displayName:"Test player " + Math.floor(1000*Math.random()),
    playerId: "playerId" + Math.random()
  }: null;

  function storeMatches() {
    matchesRef.set(angular.toJson(matches));
  }
  function storeChat() {
    chatRef.set(indexToChatMsgs);
  }

  function createCommunityMatches(): ICommunityMatch[] {
    return [
      createCommunityMatch("Greendale"),
      createCommunityMatch("Walla Walla"),
      createCommunityMatch("Santa Barbara"),
      createCommunityMatch("Valencia"),
    ];
  }
  function createCommunityMatch(matchName: string): ICommunityMatch {
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
  
  export function isInPage(page: string): boolean {
    if (page.charAt(0) !== '/') {
      throw new Error("page must start with '/', but got page=" + page);
    }
    return location.hash.indexOf('#' + page) === 0;
  }

  function isInPagePlayGame(): boolean {
    return isInPage("/playGame/");
  }

  export function showGameIframe(): boolean {
    return isInPagePlayGame() && messageSender.didGetGameReady();
  }

  export function changePage(hash: string): void {
    let currentLocation = location.hash.substring(1); // to remove "#"
    log.info("changePage from " + currentLocation + " to " + hash);
    if (currentLocation === hash) {
      return;
    }
    $location.path(hash);
    window.scrollTo(0,0);
  }

  export function gotoPlayPage(matchIndex: number) {
    changePage('/playGame/' + matchIndex);
  }
  export function gotoMainPage() {
    changePage('/main');
  }
  
  export let chatMessage = "";
  export function sendChat() {
    addChatMsg({chat: chatMessage, fromPlayer: myPlayerInfo});
    chatMessage = "";
  }
  function addChatMsg(chatMsg: ChatMsg) {
    if (!indexToChatMsgs[currentMatchIndex]) indexToChatMsgs[currentMatchIndex] = [];
    let chatMsgs = indexToChatMsgs[currentMatchIndex]; 
    chatMsgs.unshift(chatMsg);
    if (chatMsgs.length > 100) chatMsgs.pop();
    storeChat();
  }

  export let isChatShowing = false;
  export function toggleChat() {
    isChatShowing = !isChatShowing;
  }
  
  export function isYourTurn(match: ICommunityMatch) {
    return match.move.turnIndexAfterMove == myCommunityPlayerIndex &&
        !match.playerIdToProposal[myPlayerInfo.playerId];
  }

  let currentMatchIndex: number = null;
  export function getCurrentMatch() {
    return matches[currentMatchIndex];
  }
  export function loadMatch(matchIndex: number) {
    let match = matches[matchIndex];
    if (!match || !myPlayerInfo) {
      log.warn("Couldn't find matchIndex=", matchIndex);
      changePage('/main');
      return;
    }
    currentMatchIndex = matchIndex;
    sendCommunityUI();
  }

  let lastCommunityUI: ICommunityUI = null;
  function sendCommunityUI() {
    let match = matches[currentMatchIndex];
    let communityUI: ICommunityUI = {
      yourPlayerIndex: myCommunityPlayerIndex,
      yourPlayerInfo: myPlayerInfo,
      playerIdToProposal: match.playerIdToProposal,
      numberOfPlayers: match.numberOfPlayers,
      stateBeforeMove: match.stateBeforeMove,
      turnIndexBeforeMove: match.turnIndexBeforeMove,
      move: match.move,
    }
    log.info("sendCommunityUI: ", communityUI);
    lastCommunityUI = communityUI;
    messageSender.sendToGame({communityUI: communityUI});
  }

  window.addEventListener("message", function (event) {
    let game_iframe: HTMLIFrameElement = <HTMLIFrameElement>window.document.getElementById("game_iframe");
    if (!game_iframe || game_iframe.contentWindow !== event.source) {
      return;
    }
    $rootScope.$apply(function () {
      let message = event.data;
      log.info("Platform got message:", message);
      if (message.gameReady) {
        if (messageSender.didGetGameReady()) {
          log.warn("Game sent gameReady before (look at the logs)! You can only send gameReady once.");
          return;
        }
        messageSender.gotGameReady();
        return;
      }

      // {communityMove: { proposal: proposal, move: move, lastCommunityUI: lastCommunityUI }
      let communityMove: any = message.communityMove;
      if (!communityMove) {
        log.info("Not a communityMove!");
        return;
      } 
      if (!angular.equals(communityMove.lastCommunityUI, lastCommunityUI)) {
        log.error("This move belongs to an old communityUI! lastCommunityUI=\n" + 
            angular.toJson(lastCommunityUI, true) + " communityMove.lastCommunityUI=\n" +
            angular.toJson(communityMove.lastCommunityUI, true) );
        return;
      }
      let proposal: IProposal = communityMove.proposal;
      let move: IMove = communityMove.move;

      let match = matches[currentMatchIndex];
      let chatMsg:ChatMsg = {chat: "Played the move: " + proposal.chatDescription, fromPlayer: proposal.playerInfo};
      addChatMsg(chatMsg);
      if (move) {
        match.turnIndexBeforeMove = match.move.turnIndexAfterMove;
        match.stateBeforeMove = match.move.stateAfterMove;
        match.playerIdToProposal = {};
        match.move = move;
      } else {
        match.playerIdToProposal[myPlayerInfo.playerId] = proposal;
      }
      storeMatches();
      sendCommunityUI();
    });
  });

  export function googleLogin() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/plus.login');
    firebase.auth().signInWithPopup(provider).then(function(result: any) {
      // This gives you a Google Access Token. You can use it to access the Google API.
      var token = result.credential.accessToken;
      // The signed-in user info.
      var user = result.user;
      log.info("Google login succeeded: ", token, user);
    }).catch(function(error: any) {
      log.error("Google login failed: ", error);
    });
  }

  firebase.auth().onAuthStateChanged(function(user: any) {
    if (!user) return;
    // User is signed in.
    myPlayerInfo = {
      avatarImageUrl: user.photoURL,
      displayName: user.displayName,
      playerId: user.uid,
    };
    log.alwaysLog("myPlayerInfo=", myPlayerInfo);
    if ($rootScope) $rootScope.$apply();
  });

  angular.module('MyApp', ['ngMaterial', 'ngRoute'])
  .config(['$routeProvider', function($routeProvider: angular.route.IRouteProvider) {
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
  .controller('PlayGameCtrl',
        ['$routeParams',
    function($routeParams: angular.route.IRouteParamsService) {
    let matchIndex = $routeParams["matchIndex"];
    log.info("PlayGameCtrl matchIndex=", matchIndex);
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
  function (
      _timeout: angular.ITimeoutService, _interval: angular.IIntervalService,
      _interpolate: angular.IInterpolateService,
      _http: angular.IHttpService,
      _location: angular.ILocationService,
      _rootScope: angular.IScope,
      _route: angular.route.IRouteService,
      _sce: angular.ISCEService,
      _templateCache: angular.ITemplateCacheService) {
    if (_templateCache.get('html-templates/mainPage.html')) {
      log.error("Missing html-templates/mainPage.html in $templateCache");
    }
    $timeout = _timeout;
    $interval = _interval;
    $interpolate = _interpolate;
    $http = _http;
    $location = _location;
    $rootScope = _rootScope;
    $route = _route;
    $sce = _sce; // It's module-specific, or else I get: Error: [$sce:unsafe] Attempting to use an unsafe value in a safe context.

    log.alwaysLog("Angular loaded!");
    $rootScope['main'] = main;
  }]);

}
}