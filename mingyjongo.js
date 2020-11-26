#!/usr/bin/env node

const fs = require('fs');

var config = require('./config.json');

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


const PB_text = require('./PBTexts.json');

var PBChan = {};

var supportedGames = [
  {'name':'Banjo-Kazooie', 'nickname':'bk', 'id': '9dokge1p', 'last_verified': {}},
  {'name':'Banjo-Tooie', 'nickname':'bt', 'id': 'm1m7pp12', 'last_verified': {}},
  {'name':'Banjo-Kazooie: Nuts & Bolts', 'nickname':'n&b', 'id':'3dxze41y', 'last_verified': {}},
  {'name':'Banjo-Kazooie: Grunty\'s Revenge', 'nickname':'gr', 'id':'yd47epde','last_verified':{}},
  {'name':'Banjo-Pilot', 'nickname':'pilot', 'id':'k6q9rm1g','last_verified':{}}
];

//hardcoded list of mods that want to be messaged, converting their speedrun.com username into a Discord ID
//add or remove as necessary
//modsToMessage[
var modsToMessage = {'Azmi':'184166863092187136','The8bitbeast':'140431496832876544',
                    'Mittenz':'103188396129677312'};

//DISCORD
client.on('ready', () => {
    //find last verified runs
    PBChan = client.channels.find(r => r.name === config.discord.PB_channel.name);
    supportedGames.forEach((cur_game) => {
        speedrun_com.get('/runs',{
            params:{
                game: cur_game.id,
                status:'verified',
                orderby: 'verify-date',
                direction: 'desc'
            }
        }).then((response) => {
	    cur_game.last_verified = Date.parse(response.data.data[0].status['verify-date']);
        }).catch(console.error);
    });
});

const prefix = config.prefix
if(!(config.mode === 'local')){
client.on('message', (message) => {
  if(message.author.bot) return;
  if(!message.member) return;
  asker = message.mentions.users.first();
  channel = message.channel;
  if(channel.name === 'admins' || channel.name === 'server_admin'){
    if (message.member.roles.find(r => r.name === 'Administrator')){
      if(!message.content.startsWith(prefix) || message.author.bot) return;

      //seperate command from argument array
      const args = message.content.slice(prefix.length).trim().split(/ +/g);
      const command = args.shift().toLowerCase(); 
        
      switch(command){
        case "ping":
	  console.log("Ping Recieved!");
          message.channel.send('pong!');
          break;
        case "test_bk_mod":
          srcom.getGameMods('9dokge1p')
          .then(function(mods){
            var todaysMod = args.shift()%mods.length;
            console.log(config.bk_mods.currMod);
            todaysMod %= mods.length
            srcom.getUserName(mods[todaysMod])
            .then(function(username){
              if(modsToMessage[username]){
                  discord_user = client.users.get(modsToMessage[username]);
              }
              else{
                  discord_user = client.users.find(r => r.username === username);
                  modsToMessage[username] = discord_user.id;
                  // ToDo : store modsToMessage in .json 
              }
              
              if(discord_user){
                message.channel.send("messaging " + username);
                console.log(discord_user);
                discord_user.send('Bzzarrgh! Foolish bear, this is just a test of the verify runs DM system linking you to https://www.speedrun.com/runsawaitingverification');
              }
              else{
                message.channel.send("Could not find discord user " + username);
              }
            });
          });

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
    console.log('Command not sent in private_thoughts');
  }
});
}

if(!(config.mode==='local')){
//NOTIFY BK MOD TO CHECK SR.COM
var bk_mod_reminder = schedule.scheduleJob('00 21 * * *', function(){
  console.log('Checking for runs to verify');
  speedrun_com.get('/runs', {
    params: {
      game: '9dokge1p',
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
      var todaysMod = config.bk_mods.currMod;
      srcom.getGameMods('9dokge1p')
      .then(function(mods){
        console.log(config.bk_mods.currMod);
        todaysMod %= mods.length
        srcom.getUserName(mods[todaysMod])
        .then(function(username){
          discord_user = client.users.get(modsToMessage[username]);
          if(discord_user){
            //message.channel.send("messaging " + username);
            //console.log(discord_user);
            discord_user.send('Bzzarrgh! Foolish bear, why have you not checked Speedrun.com today? A few more shocks from my stick seem necessary to get you to check the ' + response.data.pagination.size + ' run'+ tempStr + ' waiting to be verified...\n https://www.speedrun.com/runsawaitingverification');
          }
          else{
            //message.channel.send("Could not find discord user " + username);
          }
        });
      });
      config.bk_mods.currMod++;
      config.bk_mods.currMod %= mods.length;
      fs.writeFileSync('./config.json',JSON.stringify(config, null, 2));
    }
  })
  .catch(console.error);
});
}


function revertPBs(cur_game, n){
    speedrun_com.get('/runs',{
        params:{
            game: cur_game.id,
            status: 'verified',
            orderby: 'verify-date',
            direction: 'desc'
        }
    }).then((response) => {
        const runs = response.data.data;
        cur_game.last_verified = Date.parse(runs[n].status['verify-date']);
	console.log(cur_game.name, ' ', cur_game.last_verified);
    });
}

function announce_run(run, cur_game, channel){
    axios.get(run.links[0].uri,{ params:{embed: 'game,category,players'}})
        .then( (response) => {
            const game_data = response.data.data.game.data;
	    const cat_data = response.data.data.category.data;
            const plyr_data = response.data.data.players.data;
	    const cat_name = game_data.names.international + ' ' + cat_data.name; 
	    var plyr_name = (plyr_data[0].names === undefined) ? plyr_data[0].name : plyr_data[0].names.international;
	    for(var i = 1; i < plyr_data.length - 1; i++){	
	        plyr_name += ', ' + ((plyr_data[i].names === undefined) ? plyr_data[i].name : plyr_data[0].names.international);
	    }
	    if (plyr_data.length > 2) plyr_name += ', ';
	    if(plyr_data.length > 1) 
	        plyr_name += '& ' + ((plyr_data[plyr_data.length-1].name === undefined) ? plyr_data[plyr_data.length-1].name : plyr_data[plyr_data.length-1].names.international);

            const time = moment.duration(response.data.data.times.primary)._data;
	    var timeStr = '';
            if(time.hours != 0){
              timeStr = timeStr + time.hours + ':';
                if(time.minutes < 10) timeStr = timeStr + '0';
            }
            timeStr = timeStr + time.minutes + ':';
            if(time.seconds < 10) timeStr = timeStr + '0';
            timeStr = timeStr + time.seconds;
                  
	    //baseGame should allow romhacks to use another game's PB texts
            const gameName = (cur_game.base_game) ? cur_game.base_game : cur_game.name; 
           
            const stringIndex = Math.floor(Math.random()*(PB_text[gameName].data.length));
	    const pb_msg = PB_text[gameName].data[stringIndex];

	    if(config.mode === 'local'){
		console.log(pb_msg.author);
		console.log(response.data.data.weblink);
		console.log(pb_msg.description);
		console.log(`${plyr_name} got a ${timeStr} in ${cat_name}!`);
		console.log(pb_msg.field.description + '\n');
	    } else {
	        var embed = new Discord.RichEmbed()
                    .setAuthor(pb_msg.author.name,pb_msg.author.image)
                    .setTitle(response.data.data.weblink)
                    .setDescription(pb_msg.description)
                    .addField(`${plyr_name} got a ${timeStr} in ${cat_name}!`,pb_msg.field.description);
	    	PBChan.send({embed})
	            .then((msg) => {if(!(config.mode === 'final')) msg.delete({timeout:30000});});
	    }
        }).catch(console.error);	
}

function checkForPBs(){
  supportedGames.forEach( (cur_game) => {
      var numberNewRuns = 0;  
      speedrun_com.get('/runs',{
          params:{
              game: cur_game.id,
              status: 'verified',
              orderby: 'verify-date',
              direction: 'desc'
          }
      }).then((response) => {
          const new_runs = response.data.data.filter((run) => {
		return  Date.parse(run.status['verify-date']) > cur_game.last_verified;
	  });
	  if(new_runs.length === 0) return;
	  const run_func = (run) => announce_run(run, cur_game);
	  new_runs.forEach(run_func);
          const ver_dates = new_runs.map( x => Date.parse(x.status['verify-date']));
          cur_game.last_verified = ver_dates.reduce((max, cur) => Math.max(max,cur), cur_game.last_verified);
	  console.log(cur_game.name , cur_game.last_verified);
      }).catch(console.error);
  });//forEach game
}

if(config.mode === 'final')
	var newPBAnnounce = schedule.scheduleJob('* * * * *', checkForPBs);

if(!(config.mode === 'local'))
    client.login(sensitive.discord.token);

process.stdin.on('data', (chunk) => {
      const message = chunk.toString().trim() 

      //seperate command from argument array
      const args = message.split(/ +/g);
      const command = args.shift().toLowerCase(); 
        
      switch(command){
        case "ping":
	  console.log("Ping Recieved!");
          break;
	case "announce_pbs":
            supportedGames.forEach( (cur_game) => {
                console.log(cur_game.name);
		speedrun_com.get('/runs',{
                    params:{
                        game: cur_game.id,
                        status: 'verified',
                        orderby: 'verify-date',
                        direction: 'desc'
                    }
                }).then((response) => {
	            const new_run = response.data.data[0];
	            announce_run(new_run, cur_game);
                }).catch(console.error);
	    });
            break;
        case "test_bk_mod":
          srcom.getGameMods('9dokge1p')
          .then(function(mods){
            var todaysMod = args.shift()%mods.length;
            console.log(config.bk_mods.currMod);
            todaysMod %= mods.length
            srcom.getUserName(mods[todaysMod])
            .then(function(username){
              if(modsToMessage[username]){
                  discord_user = client.users.get(modsToMessage[username]);
              }
              else{
                  discord_user = client.users.find(r => r.username === username);
                  modsToMessage[username] = discord_user.id;
                  // ToDo : store modsToMessage in .json 
              }
              
              if(discord_user){
                message.channel.send("messaging " + username);
                console.log(discord_user);
                discord_user.send('Bzzarrgh! Foolish bear, this is just a test of the verify runs DM system linking you to https://www.speedrun.com/runsawaitingverification');
              }
              else{
                message.channel.send("Could not find discord user " + username);
              }
            });
          });

          break;
	case "revert_pbs":
            const game_short = args.shift();
	    const rev_game = supportedGames.filter((x) => {return (x.nickname === game_short)});
	    if(rev_game.length > 0){
            	let n = args.shift();
            	revertPBs(rev_game[0], n);
	    }
            break;
        case "check_pbs":
            checkForPBs();
            break;
	default:
          break;
      }
});

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
