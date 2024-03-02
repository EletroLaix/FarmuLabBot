require('dotenv').config({ path: `./Environment/.env` })
require('dotenv').config({ path: `./Environment/.env.${process.env.Environment}` })
console.log(`Environment: ${process.env.Environment}`)

const Database = require('./database')
const { Telegraf } = require('telegraf')
const Bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
console.log(`Name bot: ${process.env.TELEGRAM_BOT_NAME}`)

async function SelfDestructingMessage(Context, Text) {
	let Message = await Context.sendMessage(Text)
	setTimeout(() => {
		Context.deleteMessage(Message.message_id).catch((e) => { console.log(e) })
	}, 5000)
}

async function CreateTopic(ChatTitle, ChatID, Username) {
	let NewTopic = await Bot.telegram.createForumTopic(ChatID, `Topic di @${Username}`)
	await Database.UpdateTopic(ChatTitle, Username, NewTopic.name, NewTopic.message_thread_id)
}

async function AddNewUser(ChatTitle, ChatID, Username, UserID) {
	await Database.AddNewUser(ChatTitle, Username, UserID)
	await CreateTopic(ChatTitle, ChatID, Username)
	return await Database.GetUser(ChatTitle, Username)
}

async function ReturnUser(ChatTitle, ChatID, Username) {
	await Database.ReturnUser(ChatTitle, Username)
	await CreateTopic(ChatTitle, ChatID, Username)
	return await Database.GetUser(ChatTitle, Username)
}

Bot.start(async (Context) => {

	await Context.sendMessage('Salve, sono FormuLab Bot 🤖')
	if (Context.chat.is_forum) {
		await Context.sendMessage('Prima di funzionare ho bisogno di verificare alcune cose:')

		await Context.sendMessage(`Verifico di essere in un super gruppo... ${(Context.chat.type == 'supergroup') ? '✅' : '❌'}`)
		let Member = await Context.telegram.getChatMember(Context.chat.id, Context.botInfo.id)
		await Context.sendMessage(`Verifico di essere amministratore... ${(Member.status === 'administrator' || Member.status === 'creator') ? '✅' : '❌'}`)
	}
	else {
		Context.sendMessage('Il mio compito è gestire un gruppo non posso essere d\'aiuto qui.')
	}
})

Bot.command('test', async (Context) => {
	if (Context.chat.is_forum && Context.message.is_topic_message) {
		let User = await Database.GetUser(Context.chat.title, Context.from.username)
		if (User != null) {
			Context.deleteMessage(Context.message.message_id)
			SelfDestructingMessage(Context, '⚠ Questo messaggo non è autorizzato')
			Database.ImcreaseUnauthorizedMessage(Context.chat.title, Context.from.username)
		}
	}
	else {
		Context.sendMessage('Test !!! 💣')
	}
})

Bot.on(['text', 'sticker', 'animation', 'audio', 'document', 'photo', 'video', 'video_note', 'voice'], async (Context) => {
	if (Context.chat.is_forum) {
		let User = await Database.GetUser(Context.chat.title, Context.from.username)
		if (User == null)
			User = await AddNewUser(Context.chat.title, Context.chat.id, Context.from.username, Context.from.id)

		if (Context.message.is_topic_message) {
			if (!Context.message.text) {
				Context.deleteMessage(Context.message.message_id)
				SelfDestructingMessage(Context, '⚠ Questo messaggo non è autorizzato')
				Database.ImcreaseUnauthorizedMessage(Context.chat.title, Context.from.username)
			}
			else if (Context.message.message_thread_id != User.Topic.ID) {
				let Memeber = await Context.getChatMember(Context.from.id)
				if ((Memeber.status != 'creator') && (Memeber.status != 'administrator')) {
					Context.deleteMessage(Context.message.message_id)
					SelfDestructingMessage(Context, '⚠ Non è il tuo topic')
					Database.ImcreaseUnauthorizedMessage(Context.chat.title, Context.from.username)
				}
			}
			else if (!Context.message.text.includes('https://makerworld.com')) {
				Context.deleteMessage(Context.message.message_id)
				SelfDestructingMessage(Context, '⚠ Questo messaggo non contiene link')
				Database.ImcreaseUnauthorizedMessage(Context.chat.title, Context.from.username)
			}
			else {
				let Link = Context.message.text.replace('/en/', '/')
				let ResultAddNewLink = await Database.AddNewLink(Context.chat.title, Context.from.username, Context.message.message_id, Link)

				if (ResultAddNewLink.IsFirstLink)
					SelfDestructingMessage(Context, 'ℹ Complimenti hai caricato il primo link 🥳')
				else if (ResultAddNewLink.LinkAlreadyExist) {
					Context.deleteMessage(Context.message.message_id)
					SelfDestructingMessage(Context, '⚠ Questo link è già stato pubblicato')
				}
				else if (ResultAddNewLink.NumberLinksExceeded) {
					Context.deleteMessage(Context.message.message_id)
					SelfDestructingMessage(Context, '⚠ Hai già pubblicato abbastanza link per questa settimana')
				}
				else
					SelfDestructingMessage(Context, `ℹ Complimenti hai caricato ${ResultAddNewLink.NumberLinks}/3 link 🦾`)
			}
		}
	}
})

Bot.on('new_chat_members', (Context) => {
	if (Context.chat.is_forum) {
		Context.update.message.new_chat_members.forEach(async (Member) => {
			let User = await Database.GetUser(Context.chat.title, Member.username)

			if (User != null) {
				Context.sendMessage(`Ben tornato, @${Member.username} ci sei mancato! 🎉`)
				User = await ReturnUser(Context.chat.title, Context.chat.id, Member.username)
			}
			else {
				Context.sendMessage(`Benvenuto, @${Member.username}! 🎉`)
				User = await AddNewUser(Context.chat.title, Context.chat.id, Member.username, Member.id)
			}
			Context.sendMessage(`ℹ Ciao @${Member.username}, questo è il topic dedicato a te, qui potrai pubblicare i link che vuoi condividere 😊`, { message_thread_id: User.Topic.ID })
		});
	}
})

Bot.on('left_chat_member', async (Context) => {
	Context.sendMessage(`Addio, @${Context.update.message.left_chat_member.username}! ⚰`)

	let User = await Database.GetUser(Context.chat.title, Context.update.message.left_chat_member.username)
	if (User != null) {
		Database.DeleteUser(Context.chat.title, Context.update.message.left_chat_member.username)
		Context.telegram.deleteForumTopic(Context.chat.id, User.Topic.ID).catch(() => { console.log('Error: Delete forum topic') })
	}
})

Bot.launch()
