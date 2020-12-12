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

let arg_to_game = (arg) => {return supportedGames.find((game) => game.nickname === arg)};

const src_moderate = { 
    cmds:{
        "help":{
            "method" : (mod,args) => src_moderate.print_help(),
            "desc" : "I relay this message."
        },
        "ignore":{
            "method" : (mod, args) => src_moderate.ignore(mod),
            "desc" : "I will stop messaging you."
        },
        "remind":{
            "method" : (mod, args) => src_moderate.remind(mod),
            "desc" : "I will stop ignoring you."
        },
        "time":{
            "method" : (mod, args) => src_moderate.set_time(mod, args),
            "desc" : "Sets what time I will message you, or reminds you of the time I currently message you.",
            "arg_desc" : "[<0-23>]"
        }
    },

    set_time: function(mod_info, args){
        if(!args.length){ 
            return "Foolish bear, I always message you at " + mod_info.time  + ":00 UTC!";
        } else {
            var new_time = args.shift();
            if(isNaN(new_time))
                channel.send("Foolish bear, " + new_time + " is not a number!");
            else{
                new_time = ((new_time % 24) + 24) % 24;
                mod_info.time = new_time;
                fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
                //TODO: reschedule any announcement jobs in progress to this mod
                return "Bzzarrgh! I'll be back at " + new_time +":00 UTC";
            }
        }
    },

    ignore: function(mod_info){
        mod_info.ignore = true;
        fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
        return "Bzzarrgh! I calculate my chances of reminding you are now minimal...";
    },

    remind: function(mod_info){
        mod_info.ignore = false;
        fs.writeFileSync('./mods.json', JSON.stringify(leaderboard_mods, null, 2));
        return "Har-har-harrr! Foolish bear, you fell straight into my trap to spam your DMs!";
    },

    print_help: function(){
        
        var help_str = 'Har-har-harrr! Foolish bear, you fell straight into my trap! I\'m not that pathetic shaman you think I am! I\'m Mingy Jongo and your worthless quest to not moderate the banjo leaderboards ends here...\n\nOnce per day I check the leaderboards for new runs. If there are any waiting to be verified I message one moderator for the game. I rotate between moderators each time I send a message as to not over burden any one moderator with messages.\n\nBzzarrgh! Now that my elaborate disguise is ruined, here are some commands you can type here to help yourself against my evil cybotic-ness!:\n\t'; 
        help_str += Object.entries(src_moderate.cmds).map((cmd)=>{
            return '\`' + config.prefix + cmd[0] + ((cmd[1].arg_desc != null)? (' ' + cmd[1].arg_desc)  : '') + '\` : '+ cmd[1].desc;
        }).join('\n\t');
        return help_str + '\n\n As you see, there\'s no escape and resistance is futile!'
    }
}

const discord_admin = {
    cmds:{
        "announce_pbs" : {
            "method" : (args) => discord_admin.rev_runs(args),
            "desc" : "rolls back *n* pb_announcements for specified game.",
            "arg_desc" : "game_nickname <int>"
        },
        "check_pbs":{
            "method" : (args) => checkForPBs(),
            "desc" : ""
        },
        "game_nicknames":{
            "method" : (args) => supportedGames.map((game) => "**" + game.nickname + "** : " + game.name).join('\n'),
            "desc" : "Returns a list of game nicknames used in other commands."
        },
        "help":{
            "method" : (args) => discord_admin.print_help(),
            "desc" : "Displays this message."
        },
        "list_mods":{
            "method" : (args) => {
                const rev_game = arg_to_game(args.shift());
                if(rev_game == null) 
                    return "Unable to list mods for unknown game";
                return Promise.all(log_mods(mod_game)).toString();
            },
            "desc" : "",
            "arg_desc" : "game_nickname"
        },
        "ping":{
            "method" : (args) => "pong!",
            "desc" : "There\'s always someone better than you - Ping-Pong the Animation"
        }
    },

    rev_runs: function(args){
        const rev_game = arg_to_game(args.shift());
        if(rev_game == null) 
            return "Unable to revert unknown game";
        let n = args.shift();
        revertPBs(rev_game, n);
        return '' + n + ' runs reverted for ' + rev_game.name;
    },
    
    print_help: function(){    
        var help_str = 'Har-har-harrr! Foolish bear, how will you stop me if you can\'t even remember a few simple commands?\n\t'; 
        help_str +=  Object.entries(discord_admin.cmds).map((cmd)=>{
            return '\`' + config.prefix + cmd[0] + ((cmd[1].arg_desc != null)? (' ' + cmd[1].arg_desc)  : '') + '\` : '+ cmd[1].desc;
        }).join('\n\t');
        return help_str;
    }
    
}

const prefix = config.prefix
if(!(config.mode === 'local')){

client.on('message', (message) => {
   if(message.author.bot || !message.content.startsWith(prefix)) return;
  
   channel = message.channel;

   //seperate command from argument array
   const args = message.content.slice(prefix.length).trim().split(/ +/g);
   const command = args.shift().toLowerCase(); 
    
    if(channel instanceof Discord.DMChannel){
        var mod_info = leaderboard_mods.find((mod) => mod.discord_id === message.author.id);
        if(mod_info != null && src_moderate.cmd[command] != null){
            console.log("!" + command + " command recieved from " +  mod_info.name);
            channel.send(src_moderate.cmd[command].method(mod_info, args));
        }
    }
    else if(channel.name === 'admins' || channel.name === 'server_admin'){
        if (message.member.roles.cache.find(r => r.name === 'Administrator')){
            if(discord_admin.cmds[command] != null){
                channel.send(discord_admin.cmds[command].method(args));
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
            if(config.mode === 'final'){
                client.users.fetch(mod_info.discord_id).then((d_usr) => {
                    d_usr.send('Hello, '+ mod_info.name + '. Mumbo has big surprise for you.');
                    d_usr.send(src_moderate.print_help());
                });
            }
            
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
            } else {
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
    
      if(discord_admin.cmds[command] != null){
          console.log(discord_admin.cmds[command].method(args));
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

    //Checks if the current run is a Personal Best for any of the runners
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
