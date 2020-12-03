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

var bk_guild = {}
var PBChan = {};

var supportedGames = require('./games.json');
var leaderboard_mods = require('./mods.json');
//hardcoded list of mods that want to be messaged, converting their speedrun.com username into a Discord ID

//DISCORD
client.on('ready', () => {
    //find last verified runs
    bk_guild = client.guilds.cache.find(r => r.name === "Banjo Speedrunning");
    PBChan = bk_guild.channels.cache.find(r => r.name === config.discord.PB_channel.name);
    supportedGames.forEach((cur_game) => {
        srcom.getVerifiedRuns(cur_game.id).then((response) => {
            cur_game.last_verified = Date.parse(response[0].status['verify-date']);
            fs.writeFileSync('./games.json', JSON.stringify(supportedGames, null, 2));
            console.log(cur_game.name , cur_game.last_verified);
	}).catch(console.error);
	
    });
});

const prefix = config.prefix
if(!(config.mode === 'local')){

client.on('message', (message) => {
   if(message.author.bot || !message.content.startsWith(prefix)) return;
  
   channel = message.channel;
   
   let arg_to_game = (arg) => {return supportedGames.find((game) => game.nickname === arg)};

   //seperate command from argument array
   const args = message.content.slice(prefix.length).trim().split(/ +/g);
   const command = args.shift().toLowerCase(); 
    
   if(channel instanceof Discord.DMChannel){
       var mod_info = leaderboard_mods.find((mod) => mod.discord_id === message.author.id);
        if(mod_info != null){
            switch(command){
                case "time":
                    if(!args.length){
                        channel.send("Foolish bear, I always message you at " + mod_info.time  + ":00 UTC!");
                    } else {
                        var new_time = args.shift();
                        if(isNaN(new_time))
                            channel.send("Foolish bear, " + new_time + " is not a number!");
                        else{
                            new_time = ((new_time % 24) + 24) % 24;
                            mod_info.time = new_time;
			    fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
                            //TODO: reschedule any announcement jobs in progress to this mod
                            channel.send("Bzzarrgh! I'll be back at " + new_time +":00 UTC");
                        }
                    }
                    break;
                case "ignore":
                    mod_info.ignore = true;
                    channel.send("Bzzarrgh! I calculate my chances of reminding you are now minimal...");
                    fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
                    break;
		case "remind":
                    mod_info.ignore = false;
                    channel.send("Har-har-harrr! Foolish bear, you fell straight into my trap to spam your DMs!");
                    fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
		    break;
		default:
                    break;
            }
        }
   }
   else if(channel.name === 'admins' || channel.name === 'server_admin'){
   if (message.member.roles.cache.find(r => r.name === 'Administrator')){

      switch(command){
        case "ping":
      console.log("Ping Recieved!");
          message.channel.send('pong!');
          break;
        case "announce_pb":
            const rev_game = arg_to_game(args.shift());
        if(rev_game == null) 
            break;
            let n = args.shift();
            revertPBs(rev_game, n);
        break;
    case "test_bk_mod":
          /*srcom.getGameMods('9dokge1p')
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
//??? from here until ???END lines may have been inserted/deleted
                discord_user.send('Bzzarrgh! Foolish bear, this is just a test of the verify runs DM system linking you to https://www.speedrun.com/runsawaitingverification');
              }
              else{
                message.channel.send("Could not find discord user " + username);
              }
            });
          });
          */
          break;
        default:
          break;
      }
    }
  }
});
}

function get_mod_info(srcID){
    var mod_info = leaderboard_mods.find(mod => mod.src_id === srcID);
    if(!(mod_info == null)) return mod_info;
  
    //create new mod
    return srcom.getUserName(srcID).then((src_info) => {
        let mod_name = src_info;
        return bk_guild.members.fetch({ query: src_info, limit: 1 }).then((m) => {
            if(m == null || m.first() == null)  return null;
        
            let d_usr = m.first().user;
            //add user to mod list
            mod_info = {"name": src_info, "src_id":srcID, "discord_id":d_usr.id, "time":21, "ignore":false};
            leaderboard_mods.push(mod_info);
            fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
            
	    client.users.fetch(mod_info.discord_id).then((d_usr) => {
                d_usr.send('Hello, '+ mod_info.name + '. Mumbo has big surprise for you.');
		d_usr.send('Har-har-harrr! Foolish bear, you fell straight into my trap! I\'m not that pathetic shaman you think I am! I\'m Mingy Jongo and your worthless quest to not moderate the banjo leaderboards ends here...\n\nOnce per day I check the leaderboards for new runs. If there are any waiting to be verified I message one moderator for the game. I rotate between moderators each time I send a message as to not over burden any one moderator with messages.\n\nBzzarrgh! Now that my elaborate disguise is ruined, here are some commands you can type here to help yourself against my evil cybotic-ness!:\n\t\`!time\` I tell you what time I plan the message you.\n\t\`!time <0-23>\` Sets what time I will message you\n\t\`!ignore\` I will stop messaging you.\n\t\`!remind\` I will stop ignoring you.\n\n As you see, there\'s no escape and resistance is futile!');
	    });
            
            return mod_info;
        });
    });
}

function log_mods(cur_game){
    return srcom.getGameMods(cur_game.id).then((src_mods) => {
        return Promise.all(src_mods.map((x) => {
            let mod_info =  get_mod_info(x);
            if(mod_info == null || mod_info.discord_id == null){
                return srcom.getUserName(x).then((src_info) => {
                    return x + ' ' + src_info + ' !NOT FOUND IN DISCORD';
                });
            }
        
            if(mod_info.ignore) return x + ' ' + mod_info.name + ' !SET TO IGNORE';
            return client.users.fetch(mod_info.discord_id).then((d_usr) => {
                return mod_info.src_id + ' ' + mod_info.name + ' ' + d_usr.tag + ' @ ' + mod_info.time + ':00';
            });
        }));
    });
}

function check_awaiting_verification(cur_game){
    console.log("Checking for new " +cur_game.name + "runs");
    srcom.getNewRuns(cur_game.id).then((new_runs)=>{    
        if((config.mode === 'final')&&(new_runs.length === 0)) return;
        srcom.getGameMods(cur_game.id).then((src_mods) => {
        var iMod =  cur_game.current_mod % src_mods.length;
        var cur_mod = src_mods[iMod];
        var mod_info;
        var i = 0;
    do{
        cur_mod = src_mods[(iMod + i)%src_mods.length];
        mod_info = get_mod_info(cur_mod);
        if(mod_info == null || mod_info.discord_id == null || mod_info.ignore){
            console.log('Couldn\'t find ' + cur_game.name + ' mod' + (iMod + i)%src_mods.length);
            i++;
            if(i === src_mods.length){
                console.log('NO MODS CAN BE MESSAGED FOR ' + cur_game.name.toUpperCase());
                return; //NO MESSAGABLE MODS
            }
        }   
    } while(mod_info == null || mod_info.discord_id == null || mod_info.ignore);
        
    //send_msg
    console.log('Messaging ' + mod_info.name + ' about ' + new_runs.length + ' new runs');
    if(config.mode === 'final'){
            client.users.fetch(mod_info.discord_id).then((d_usr) => {
            d_usr.send('Bzzarrgh! Foolish bear, why have you not checked Speedrun.com today? A few more shocks from my stick seem necessary to get you to check the ' + new_runs.length + ' run'+ ((new_runs.length === 1)?'':'s')  + ' waiting to be verified...\n https://www.speedrun.com/runsawaitingverification').then((msg) => msg.delete({timeout: 2*24*60*60*1000}));
        });
    }

    var jMod = (iMod + i + 1)%src_mods.length;
    var next_mod = cur_mod;
    i = 0;
    do{
        next_mod = src_mods[(jMod + i)%src_mods.length];
        mod_info = get_mod_info(next_mod);
        if(mod_info == null || mod_info.discord_id == null || mod_info.ignore){
            console.log('Couldn\'t find ' + cur_game.name + ' mod' + (jMod + i)%src_mods.length);
                i++;
            if(i === src_mods.length){
                    console.log('NO MODS CAN BE MESSAGED FOR ' + cur_game.name.toUpperCase());
            return; //NO MESSAGABLE MODS
        }
        }
    } while(mod_info == null || mod_info.discord_id == null || mod_info.ignore);
        //reschedule event  
    console.log('Setting time to ' + mod_info.time + ' for ' + mod_info.name);
    mod_reminder[cur_game.id].cancel();
    var mod_reschedule = () => {mod_reminder[cur_game.id].reschedule('00 00 ' + next_mod.time + ' * * *');};
    setTimeout(mod_reschedule, 12*60*60*1000);//wait twelve hours before rescheduling -> average 24 hours between mod switch
    cur_game.current_mod = (jMod +i)%src_mods.length;
    supportedGames[supportedGames.findIndex((x) => x.id === cur_game.id)] = cur_game;
    fs.writeFileSync('./games.json', JSON.stringify(supportedGames, null, 2));
    });
    });
}

var mod_reminder = {};
supportedGames.forEach((cur_game) => {
    mod_reminder[cur_game.id] = schedule.scheduleJob('00 00 21 * * *', ()=>{check_awaiting_verification(cur_game);});
});


function revertPBs(cur_game, n){
    srcom.getVerifiedRuns(cur_game.id).then((runs) => {
        cur_game.last_verified = Date.parse(runs[n].status['verify-date']);
    console.log(cur_game.name, ' ', cur_game.last_verified);
    });
}


function announce_run(run, cur_game, channel){
    console.log('Announcing run ' + run + ' for ' + cur_game.name);
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
            var embed = new Discord.MessageEmbed()
                    .setAuthor(pb_msg.author.name,pb_msg.author.image)
                    .setTitle(response.data.data.weblink)
                    .setDescription(pb_msg.description)
                    .addField(`${plyr_name} got a ${timeStr} in ${cat_name}!`,pb_msg.field.description);
            if(config.mode === 'final'){
            PBChan.send({embed})
        }
        else{
            PBChan.send({embed}).then(rply => setTimeout(() => rply.delete(), 15*1000));
        }
        }
        }).catch(console.error);    
}

function checkForPBs(){
    console.log('Checking for PBS');
    supportedGames.forEach( (cur_game) => {
      var numberNewRuns = 0;  
      srcom.getVerifiedRuns(cur_game.id).then((response) => {
	  console.log(cur_game.name + ' last verified ' + cur_game.last_verified);
          const new_runs = response.filter((run) => {
            return  Date.parse(run.status['verify-date']) > cur_game.last_verified;
          });
      if(new_runs.length === 0) {
	      console.log('No new runs for '+cur_game.name);
	      return;
      }
      const run_func = (run) => announce_run(run, cur_game);
      new_runs.forEach((run) => srcom.isPB(run.id).then((x) => {if(x === true) announce_run(run,cur_game);}));
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

if(!(config.mode === 'final'))
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
        srcom.getVerifiedRuns(cur_game.id)
                .then((new_runs) => {
                announce_run(new_runs[0], cur_game);
                }).catch(console.error);
        });
            break;
        case "list_mods":
            const mod_short = args.shift();
            const mod_game = supportedGames.find((x) => {return (x.nickname === mod_short)});
        if(!(mod_game === undefined)){
        log_mods(mod_game).then((x) => 
                console.log(x));
        }

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
        case "check_new":   
            const check_short = args.shift();
        const check_game = supportedGames.find((x) => {return (x.nickname === check_short)});
        if(check_game != null){ 
        console.log(check_game);
                check_awaiting_verification(check_game);
        }
    default:
          break;
      }
});

srcom = {
    getGameMods: function(gameID){
        return speedrun_com.get('/games/' + gameID, {params: {}})
            .then(gameResp => Object.keys(gameResp.data.data.moderators));
    },

    getUserName: function(userID){
        return speedrun_com.get('/users/' + userID, {params: {}})
            .then(userResp => userResp.data.data.names.international);
    },
    
    getUserPBs: function(userID, gameID){
        return speedrun_com.get('/users/' + userID + '/personal-bests', {params:{game:gameID}})
        .then(resp => resp.data.data.map(x => x.run));
    },

    getVerifiedRuns: function(gameID){
    return speedrun_com.get('/runs',{
            params:{ game: gameID, status: 'verified',
                     orderby: 'verify-date', direction: 'desc'}
            }).then((response) => {return response.data.data;});
    },

    getNewRuns: function(gameID){
        return speedrun_com.get('/runs', {params:{game: gameID, status: 'new'}})
        .then((resp) => {return resp.data.data;});
    },

    isPB: function(runID){
        return speedrun_com.get('/runs/' + runID, {params:{}})
            .then((resp) => {
                let plyrs = resp.data.data.players;
        let game = resp.data.data.game;
        return plyrs.map((plyr) => {
            return srcom.getUserPBs(plyr.id, game)
                .then((pb_runs) => {
                    let pb_ids = pb_runs.map((x) => {return x.id});
                return pb_ids.includes(runID);
            });
        });
            })
        .then((resp) => {
            return Promise.all(resp).then((x) => {return x.includes(true);});
        });
    }
}
