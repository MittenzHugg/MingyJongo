#!/usr/bin/env node

const fs = require('fs');

//sensitive data(i.e. oauth tokens)
const sensitive = require('./sensitive.json');

//Discord
const Discord = require('discord.js');
const client = new Discord.Client();

//Timing
const moment = require('moment');
var schedule = require('node-schedule');

//REST APIs
const axios = require('axios');
var speedrun_com = axios.create({
  baseURL: 'https://www.speedrun.com/api/v1'
});

var config = require('./config.json');

const PB_text = require('./PBTexts.json');

var PBChan = {};

var supportedGames = [
  {'name':'Banjo-Kazooie', 'id': '9dokge1p','last_verified': {}},
  {'name':'Banjo-Tooie', 'id': 'm1m7pp12', 'last_verified': {}},
  {'name':'Banjo-Kazooie: Nuts & Bolts', 'id':'3dxze41y', 'last_verified': {}},
  {'name':'Banjo-Kazooie: Grunty\'s Revenge', 'id':'yd47epde','last_verified':{}},
  {'name':'Banjo-Pilot', 'id':'k6q9rm1g','last_verified':{}}
];

//DISCORD
client.on('ready', () => {
  //find last verified runs
  PBChan = client.channels.find(r => r.name === config.discord.PB_channel.name);
  for (var i = 0; i < supportedGames.length; i++){
    speedrun_com.get('/runs',{
      params:{
        game: supportedGames[i].id,
        status:'verified',
        orderby: 'verify-date',
        direction: 'desc'
      }
    })
    .then(function (response){
      for(var i = 0; i< supportedGames.length; i++){
        if(response.data.data[0].game == supportedGames[i].id){
          supportedGames[i].last_verified = Date.parse(response.data.data[0].status['verify-date']);
          //console.log(supportedGames[i]);
          i = supportedGames.length;
        }
      }
    })
    .catch(console.error);
  }
});

function updateHour(userID, newHour) {
	//make sure it's a legit hour (less than 0 is okay, just means do not DM)
	if (newHour > 23 || !Number.isInteger(newHour)) { return false; }
	var foundUser = false;
	for(var i = 0; i< supportedGames.length; i++){
		for (var j = 0; j < config.gameMods[supportedGames[i].name].length; j++) {
			var tempMod = config.gameMods[supportedGames[i].name][j]
			if (tempMod.id === userID) {
				//TODO: Add ALL moderators to the config file, with an hour of -1
				foundUser = true;
				tempMod.hour = newHour;
			}
		}
	}
	if (foundUser) { fs.writeFileSync('./config.json',JSON.stringify(config)); }
	return foundUser;
}

const prefix = config.prefix
client.on('message', (message) => {
  if(message.author.bot) return;
  if(!message.member) return;
  asker = message.mentions.users.first();
  channel = message.channel;
  //if(channel.name === 'private_thoughts'){
  if(channel.name === 'admins'){
    if (message.member.roles.find(r => r.name === 'Administrator')){
      if(!message.content.startsWith(prefix) || message.author.bot) return;

      //seperate command from argument array
      const args = message.content.slice(prefix.length).trim().split(/ +/g);
      const command = args.shift().toLowerCase(); 
        
      switch(command){
        case "ping":
          message.channel.send('pong!');
          break;
        case "test_bk_mod":
		  var todaysMod = config.gameMods[supportedGames[0].name][config.currMod[0]];
		  console.log(config.currMod[i]);
		  if(todaysMod.id){
			  discord_user = client.users.get(todaysMod.id);
		  }
		  else{
			  discord_user = client.users.find(r => r.username === todaysMod.name);
			  todaysMod.id = discord_user.id; 
		  }
		   if(discord_user){
			message.channel.send("messaging " + username);
			console.log(discord_user);
			discord_user.send('Bzzarrgh! Foolish bear, this is just a test of the verify runs DM system linking you to https://www.speedrun.com/runsawaitingverification');
		  }
		  else{
			message.channel.send("Could not find discord user " + username);
		  }
          break;
		case "start":
			var newHour = parseInt(args[0]);
			if (newHour === NaN || !Number.isInteger(newHour) || newHour < 0 || newHour > 23) {
				message.member.send("Foolish human! You must enter an hour between 0 and 23! And make sure you are a game moderator as well!");
			}
			else if (updateHour(message.member.id, newHour)) {
				message.channel.send("You will now receive run verification notifications at " + newHour + ":00!");
			}
			else {
				message.member.send("Foolish human! You must be a game moderator to receive my notifications!");
			}
			break;
		case "stop":
			if (updateHour(message.member.id, -1)) {
				message.channel.send("You are free from my notifications... for now...");
			}
			break;
        default:
          break;
      }
    }
    else{
      console.log('Command not sent by Mittenz');
    }
  }
  else{
    console.log('Command not sent in admins');
  }
});

//NOTIFY BK MOD TO CHECK SR.COM
var bk_mod_reminder = schedule.scheduleJob('00 * * * *', function(fireDate){
  console.log('Checking for runs to verify');
  for(var i = 0; i< supportedGames.length; i++){
	  //Daily mod change
	  if(fireDate.getHours() == 0) { 
		do {
			config.currMod[i]++;
			config.currMod[i] %= config.gameMods[i].length;
		}
		while (config.gameMods[supportedGames[i].name][config.currMod[i]].hour < 0);
	  }
	  var todaysMod = config.gameMods[supportedGames[i].name][config.currMod[i]]
	  //it's this mod's time
	  if(fireDate.getHours() == todaysMod.hour) {
		  speedrun_com.get('/runs', {
			params: {
			  game: supportedGames[i].id,
			  status: 'new'
			}
		  })
		  .then(function (response) {
			if(response.data.pagination.size != 0){
			  var tempStr = 's';
			  if(response.data.pagination.size == 1){
				tempStr = ''
			  }

			  //find game mods
			  console.log(config.currMod[i]);
			  discord_user = client.users.get(todaysMod.id);
			  if(discord_user){
				//message.channel.send("messaging " + username);
				//console.log(discord_user);
				discord_user.send('Bzzarrgh! Foolish bear, why have you not checked Speedrun.com today? A few more shocks from my stick seem necessary to get you to check the ' + response.data.pagination.size + ' run'+ tempStr + ' waiting to be verified...\n https://www.speedrun.com/runsawaitingverification');
			  }
			  else{
				//message.channel.send("Could not find discord user " + username);
			  }
			}
		  })
		  .catch(console.error);
	  }
  }
  fs.writeFileSync('./config.json',JSON.stringify(config));
});


//CHECK SR.COM FOR NEW PB's
var newPBAnnounce = schedule.scheduleJob('* * * * *', function(){
  //console.log('Checking for new PBs');
  for(var i = 0; i < supportedGames.length; i++){
  //for(var i = 0; i < 1; i++){
    var numberNewRuns = 0;
    speedrun_com.get('/runs',{
      params:{
        game: supportedGames[i].id,
        status: 'verified',
        orderby: 'verify-date',
        direction: 'desc'
      }
    })
    .then(function(response){
       var gameIndex = 0;
       for(var i = 0; i<supportedGames.length; i++){
         if(supportedGames[i].id == response.data.data[0].game){
           gameIndex = i;
         }
       }
       
       for(var i = 0; i < response.data.pagination.size && supportedGames[gameIndex].last_verified < Date.parse(response.data.data[i].status['verify-date']); i++){
         axios.get(response.data.data[i].links[0].uri,{
           params:{
             embed: 'game,category,players'
           }
         })
         .then(function(response){
           var catName = response.data.data.game.data.names.international + ' ' + response.data.data.category.data.name;
           var userName = response.data.data.players.data[0];
           if(userName.names === undefined){
             userName = userName.name;
           }
           else{
             userName = userName.names.international;
           }
           var time =  moment.duration(response.data.data.times.primary)._data;
           var timeStr = '';
           if(time.hours != 0){
             timeStr = timeStr + time.hours + ':';
             if(time.minutes < 10){
               timeStr = timeStr + '0';
             }
           }
           timeStr = timeStr + time.minutes + ':';
           if(time.seconds < 10){
               timeStr = timeStr + '0';
           }
           timeStr = timeStr + time.seconds;
           
           var gameName = supportedGames[i].name;
           //baseGame would allow romhacks to use another game's PB texts
           if (supportedGames[i].base_game) { gameName = supportedGames[i].base_game; }
           
           stringIndex = Math.floor(Math.random()*(PB_text[gameName].data.length +1 ));
          var embed = new Discord.RichEmbed()
            .setAuthor(PB_text[gameName].data[stringIndex].author.name,PB_text[gameName].data[stringIndex].author.image)
            .setTitle(response.data.data.weblink)
            .setDescription(PB_text[gameName].data[stringIndex].description)
            .addField(`${userName} got a ${timeStr} in ${catName}!`,PB_text[gameName].data[stringIndex].field.description);
            //.setThumbnail(response.data.data.videos.links[0].uri);
          PBChan.send({embed});
         })
         .catch(console.error);
       }
       supportedGames[gameIndex].last_verified = Date.parse(response.data.data[0].status['verify-date']);
    })
    .catch(console.error);
  }
});

client.login(sensitive.discord.token);

srcom = {
  getGameMods: function(gameID){
    return speedrun_com.get('/games/' + gameID, {
      params: {
      }
    })
    .then(function (gameResp) {
      return Object.keys(gameResp.data.data.moderators);
    });
  },

  getUserName: function(userID){
    return speedrun_com.get('/users/' + userID, {
      params: {
      }
    })
    .then(function (userResp) {
      return userResp.data.data.names.international;
    });
  }
}
