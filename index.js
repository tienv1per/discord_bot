/*
discord.js: ^14.7.1
*/

const { joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    entersState,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { default: axios } = require('axios');
const { 
    REST, 
    Routes, 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder,
    ChannelType,
    AttachmentBuilder
} = require('discord.js');

const googleTTS = require('google-tts-api')
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

const tokenArr = [
    "MTA4MzczMjg1NTUxMjg5OTYzNQ",
    "GJ2Vld",
    "4pIJpRoY9y1loEvz0zXaaW56F_BIMOF2Hiaufc"
]
const TOKEN = tokenArr.join('.');
const CLIENT_ID = "1083732855512899635";

//Invite link:  https://discord.com/api/oauth2/authorize?client_id=1083732855512899635&permissions=137471948864&scope=bot

process.on('unhandledRejection', (reason, p) => {
    console.log("Reason", reason, "Promise", p);
}).on('uncaughtException', err => {
    console.log("uncaughtException", err);
})


//App commands
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: [
                new SlashCommandBuilder()
                    .setName('say')
                    .setDescription('Say something in voice channel')
                    .addStringOption(option => 
                        option.setName('content')
                            .setDescription('Type what you want bot to say')
                            .setRequired(true)
                    )
                    .toJSON(),
                new SlashCommandBuilder()
                    .setName('join')
                    .setDescription('Join a voice channel')
                    .addChannelOption((option) => 
                        option.setName('channel')
                            .setDescription('The channel to join')
                            .setRequired(true)
                            .addChannelTypes(ChannelType.GuildVoice)
                    )
                    .toJSON(),
                new SlashCommandBuilder()
                    .setName('gpt')
                    .setDescription('Chat with ChatGPT')
                    .addStringOption(option => 
                        option.setName('message')
                            .setDescription('Type what you want to chat with ChatGPT')
                            .setRequired(true)
                    )
                    .toJSON(),
                new SlashCommandBuilder()
                    .setName('disconnect')
                    .setDescription('Disconnect from current channel')
                    .toJSON(),
                new SlashCommandBuilder()
                    .setName('leave')
                    .setDescription('Disconnect from current channel')
                    .toJSON(),
            ],
        });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();



//Main

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
})

async function textToSpeech(message, connection) {
    console.log({
        voice_state: connection.state.status,
        content: message
    })
    
    const voiceURL = googleTTS.getAudioUrl(message, {
        lang: 'vi',
        slow: false,
        host: 'https://translate.google.com',
        splitPunct: ',.?',
    })
    const { data } = await axios.get(voiceURL, {
        responseType: 'arraybuffer',
        headers: {
            "Content-Type": 'audio/mpeg'
        }
    })
    const writer = fs.createWriteStream('./audio.mp3')
    writer.write(data)

    setTimeout(()=>{
        const player = createAudioPlayer()
        const resource = createAudioResource('./audio.mp3')
        player.play(resource)
        
        connection?.subscribe(player)
    }, 200)
}

async function joinChannel(voiceChannel, voiceConnection) {
    await entersState(voiceConnection, VoiceConnectionStatus.Ready, 5e3)
    await textToSpeech("Ếch xanh đã tham gia kênh chat", voiceConnection)
    console.log(`Joining channel ${voiceChannel.id}`)
}

async function chatGPT(message, replyCallback){
    const configuration = new Configuration({
        apiKey: "sk-"+"vxQ0rzd0diusInHtnUGbT3BlbkFJF4NyAjiaVWq989lUzvLa"
    })
    const openAI = new OpenAIApi(configuration)
    const res = await openAI.createCompletion({
        model: 'text-davinci-003',
        prompt: message,
        max_tokens: 2048,
    })
    const resMsg = '> ' + message + res.data.choices[0].text
    if(resMsg.length >= 2000){
        const attachment = new AttachmentBuilder(Buffer.from(resMsg, 'utf-8'), {name: 'response.txt'})
        await replyCallback({files: [attachment]})
    }else{
        await replyCallback(resMsg)
    }
}

client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;
        
        // VOICE SPEAK
        if (interaction.commandName === 'say') {
            const voiceMessage = interaction.options.getString('content')
            const voiceConnection = getVoiceConnection(interaction.guildId)
            if(!voiceConnection?.state?.status){
                await interaction.reply(`Ếch chưa vào kênh. Hãy sử dụng \`/join\` để triệu hồi Ếch`);
                return;
            }            

            textToSpeech(voiceMessage, voiceConnection).then(async () => {
                await interaction.reply(`>>> ${voiceMessage}`);
            })
        }

        // CHAT GPT
        if (interaction.commandName === 'gpt') {
            const message = interaction.options.getString('message')
            // const connection = getVoiceConnection(interaction.guildId)

            await interaction.deferReply({content: "Kết nối với ChatGPT..."})

            chatGPT(message, async (replyContent) => {
                await interaction.editReply(replyContent)
            })
            // textToSpeech(voiceMessage, voiceConnection).then(async () => {
            //     await interaction.reply(`>>> ${voiceMessage}`);
            // })
        }

        // JOIN CHANNEL
        if (interaction.commandName === 'join') {
            const voiceChannel = interaction.options.getChannel('channel')
            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            })
            joinChannel(voiceChannel, voiceConnection).then(async () => {
                await interaction.reply(`Ếch xanh đã tham gia **${voiceChannel.name}**.`)
            })
        }

        // DISCONNECT
        if (interaction.commandName === 'disconnect'
            || interaction.commandName === 'leave') {
            const voiceConnection = getVoiceConnection(interaction.guildId)
            voiceConnection?.destroy()

            await interaction.reply(`Ếch xanh đã trở về môi trường hoang dã.`)
        }
    } catch (error) {
        console.log(error);
    }
});

client.login(TOKEN)