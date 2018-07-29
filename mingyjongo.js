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


var PBChan = {};

var supportedGames = [
  {'name':'Banjo-Kazooie', 'id': '9dokge1p','last_verified': {}},
  {'name':'Banjo-Tooie', 'id': 'm1m7pp12', 'last_verified': {}},
  {'name':'Banjo-Kazooie: Nuts & Bolts', 'id':'3dxze41y', 'last_verified': {}},
  {'name':'Banjo-Kazooie: Grunty\'s Revenge', 'id':'yd47epde','last_verified':{}}
];

//DISCORD
client.on('ready', () => {
  //find last verified runs
  PBChan = client.channels.find('name','community-pbs');
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

const prefix = '!'
client.on('message', (message) => {
  if(!message.content.startsWith(prefix) || message.author.bot) return;

  if(message.content.startsWith(prefix + 'ping')){
    message.channel.send('pong!');
  }
});

//NOTIFY BK MOD TO CHECK SR.COM
var bk_mod_reminder = schedule.scheduleJob('20 * * *', function(){
  console.log('Checking for runs to verify');
  speedrun_com.get('/runs', {
    params: {
      game: '9dokge1p',
      status: 'new'
    }
  })
  .then(function (response) {
    if(response.data.pagination.size != 0){
      //DM correct mod
      var tempStr = 's';
      if(response.data.pagination.size == 1){
        tempStr = ''
      }
      var  today = new Date().getDay()
      var  todaysMod =  client.users.find('username','Mittenz');
      switch(today){
        case 0: //Sunday 
          todaysMod = client.users.find('id','TheMartonfi');
          break;
        case 1:
          todaysMod = client.users.find('username','Stivitybobo');
          break;
        case 2:
          todaysMod = client.users.find('username','kaptainkohl');
          break;
        case 3:
          todaysMod = client.users.find('username','Hyper');
          break;
        case 4:
          todaysMod = client.users.find('username','SecretHumorMan');
          break;
        case 5:
          todaysMod = client.users.find('username','The8bitbeast');
          break;
        default:
          todaysMod =  client.users.find('username','Mittenz');
          break;
      }    

      todaysMod.send('Bzzarrgh! Foolish bear, why have you not checked Speedrun.com today? A few more shocks from my stick seem necessary to get you to check the ' + response.data.pagination.size + ' run'+ tempStr + ' waiting to be verified...');
    }
  })
  .catch(console.error);
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
           var gameName = response.data.data.game.data.names.international;
           var catName = response.data.data.category.data.name;
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
           PBChan.send('Bzzarrgh! ' + userName + ' got a ' + timeStr + time.minutes + ':' + time.minutes + ' in ' + gameName + catName + '! I  calculate my chances of stopping them are now minimal...');
         })
         .catch(console.error);
       }
       supportedGames[gameIndex].last_verified = Date.parse(response.data.data[0].status['verify-date']);
    })
    .catch(console.error);
  }
});

client.login(sensitive.discord.token);

