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

interface MyPlayerInfo extends IPlayerInfo {
  myCommunityPlayerIndex: number;
}

interface ICommunityMatch extends IStateTransition {
  matchName: string;
  playerIdToProposal: IProposals; 
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
  // Feel free to change to your own Firebase URL :)
  // Initialize Firebase
  var config = {
    apiKey: "AIzaSyDvbUblHfA5eJe5sK1Xy-xC_tfV4y4PgQE",
    authDomain: "signalling-d073b.firebaseapp.com",
    databaseURL: "https://signalling-d073b.firebaseio.com",
    storageBucket: "signalling-d073b.appspot.com",
    messagingSenderId: "308144322392"
  };
  firebase.initializeApp(config);
  export let matches: ICommunityMatch[] = [];
  // Saving as json because firebase has restriction on keys (and we use "data: any").
  // Example error: Firebase.set failed: First argument  contains an invalid key (playerId0.5446834512026781) in property 'matches.0.playerIdToProposal'.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
  // Another weird thing: For some reason firebase stores "{}" as null (for playerIdToProposal).
  let matchesRef = firebase.database().ref("matchesJson");
  matchesRef.on('value', function(snapshot: any) {
    $timeout(()=> {
      let matchesJson = snapshot.val();
      if (!matchesJson) {
        matches = createCommunityMatches(); 
        storeMatches();
      } else {
        matches = angular.fromJson(matchesJson);
        if (showGameIframe()) sendCommunityUI();
      }
    });
  });

  export let myPlayerInfo: MyPlayerInfo = getMyPlayerInfo();
  log.alwaysLog("myPlayerInfo=", myPlayerInfo);

  function getMyPlayerInfo() {
    let myPlayerInfoJson = localStorage.getItem("myPlayerInfoJson");
    if (myPlayerInfoJson) return angular.fromJson(myPlayerInfoJson);
    myPlayerInfo = {
      avatarImageUrl: "http://graph.facebook.com/10154287448416125/picture?square=square",
      displayName: "Guest player " + (1+Math.floor(999*Math.random())),
      myCommunityPlayerIndex: 
        location.search.indexOf('playBlack') != -1 ? 0 :
        location.search.indexOf('playWhite') != -1 ? 1 : 
        Math.random() > 0.5 ? 0 : 1,
      playerId: "playerId" + Math.floor(1000000*Math.random()),
    };
    localStorage.setItem("myPlayerInfoJson", angular.toJson(myPlayerInfo));
    return myPlayerInfo;
  }

  function storeMatches() {
    matchesRef.set(angular.toJson(matches));
  }

  function createCommunityMatches(): ICommunityMatch[] {
    return [
      createCommunityMatch("Greendale"),
      createCommunityMatch("Walla Walla"),
      createCommunityMatch("Santa Barbara"),
      createCommunityMatch("Valencia")
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
  
  export function isYourTurn(match: ICommunityMatch) {
    return match.move.turnIndexAfterMove == myPlayerInfo.myCommunityPlayerIndex &&
        !match.playerIdToProposal[myPlayerInfo.playerId];
  }

  let currentMatchIndex: number = null;
  export function loadMatch(matchIndex: number) {
    let match = matches[matchIndex];
    if (!match) {
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
      yourPlayerIndex: myPlayerInfo.myCommunityPlayerIndex,
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


  function FriendlyChat() {
  this.checkSetup();

  // Shortcuts to DOM Elements.
  this.messageList = document.getElementById('messages');
  this.messageForm = document.getElementById('message-form');
  this.messageInput = document.getElementById('message');
  this.submitButton = document.getElementById('submit');
  this.submitImageButton = document.getElementById('submitImage');
  this.imageForm = document.getElementById('image-form');
  this.mediaCapture = document.getElementById('mediaCapture');
  this.userPic = document.getElementById('user-pic');
  this.userName = document.getElementById('user-name');
  this.signInButton = document.getElementById('sign-in');
  this.signOutButton = document.getElementById('sign-out');
  this.signInSnackbar = document.getElementById('must-signin-snackbar');

  // Saves message on form submit.
  this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));

  // Toggle for the button.
  var buttonTogglingHandler = this.toggleButton.bind(this);
  this.messageInput.addEventListener('keyup', buttonTogglingHandler);
  this.messageInput.addEventListener('change', buttonTogglingHandler);

  // Events for image upload.
  this.submitImageButton.addEventListener('click', function() {
    this.mediaCapture.click();
  }.bind(this));
  this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));

  this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
FriendlyChat.prototype.initFirebase = function() {
  // TODO(DEVELOPER): Initialize Firebase.
};

// Loads chat messages history and listens for upcoming ones.
FriendlyChat.prototype.loadMessages = function() {
  // TODO(DEVELOPER): Load and listens for new messages.
};

// Saves a new message on the Firebase DB.
FriendlyChat.prototype.saveMessage = function(e:any) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (this.messageInput.value && this.checkSignedInWithMessage()) {

    // TODO(DEVELOPER): push new message to Firebase.

  }
};

// Sets the URL of the given img element with the URL of the image stored in Firebase Storage.
FriendlyChat.prototype.setImageUrl = function(imageUri:any, imgElement:any) {
  imgElement.src = imageUri;

  // TODO(DEVELOPER): If image is on Firebase Storage, fetch image URL and set img element's src.
};

// Saves a new message containing an image URI in Firebase.
// This first saves the image in Firebase storage.
FriendlyChat.prototype.saveImageMessage = function(event:any) {
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  this.imageForm.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (this.checkSignedInWithMessage()) {

    // TODO(DEVELOPER): Upload image to Firebase storage and add message.

  }
};

// Signs-in Friendly Chat.
FriendlyChat.prototype.signIn = function() {
  // TODO(DEVELOPER): Sign in Firebase with credential from the Google user.
};

// Signs-out of Friendly Chat.
FriendlyChat.prototype.signOut = function() {
  // TODO(DEVELOPER): Sign out of Firebase.
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
FriendlyChat.prototype.onAuthStateChanged = function(user:any) {
  if (user) { // User is signed in!
    // Get profile pic and user's name from the Firebase user object.
    var profilePicUrl:any = null;   // TODO(DEVELOPER): Get profile pic.
    var userName:any = null;        // TODO(DEVELOPER): Get user's name.

    // Set the user's profile pic and name.
    this.userPic.style.backgroundImage = 'url(' + profilePicUrl + ')';
    this.userName.textContent = userName;

    // Show user's profile and sign-out button.
    this.userName.removeAttribute('hidden');
    this.userPic.removeAttribute('hidden');
    this.signOutButton.removeAttribute('hidden');

    // Hide sign-in button.
    this.signInButton.setAttribute('hidden', 'true');

    // We load currently existing chant messages.
    this.loadMessages();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    this.userName.setAttribute('hidden', 'true');
    this.userPic.setAttribute('hidden', 'true');
    this.signOutButton.setAttribute('hidden', 'true');

    // Show sign-in button.
    this.signInButton.removeAttribute('hidden');
  }
};


// Enables or disables the submit button depending on the values of the input
// fields.
FriendlyChat.prototype.toggleButton = function() {
  if (this.messageInput.value) {
    this.submitButton.removeAttribute('disabled');
  } else {
    this.submitButton.setAttribute('disabled', 'true');
  }
};




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
      // TODO: add proposal.chatDescription + proposal.playerInfo (avatar+displayName) to the group chat.
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