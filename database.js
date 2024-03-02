const Admin = require("firebase-admin")
const { getDatabase } = require("firebase-admin/database")
const { ref, get, set } = require("firebase/database")

const DB = getDatabase(
	Admin.initializeApp({
		credential: Admin.credential.cert({
			"type": "service_account",
			"project_id": process.env.FIREBASE_PROJECT_ID,
			"private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
			"private_key": process.env.FIREBASE_PRIVATE_KEY,
			"client_email": process.env.FIREBASE_CLIENT_EMAIL,
			"client_id": process.env.FIREBASE_CLIENT_ID,
			"auth_uri": "https://accounts.google.com/o/oauth2/auth",
			"token_uri": "https://oauth2.googleapis.com/token",
			"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
			"client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL,
			"universe_domain": "googleapis.com"
		}),
		databaseURL: process.env.FIREBASE_DATABASE_URL
	})
)

function GetNameActualSprint() {
	const Now = new Date()
	const Year = Now.getFullYear()
	const OneJan = new Date(Year, 0, 1);
	const WeekNumber = Math.ceil((((Now - OneJan) / 86400000) + OneJan.getDay() + 1) / 7);

	return `${Year}-${WeekNumber}`
}

class Database {
	Database() { }

	async AddNewUser(ChatTitle, Username, UserID) {
		console.log(`New member: @${Username}`)

		let User = {
			UserID: UserID,
			InGroup: true,
			Topic: {
				Name: "",
				ID: 0
			},
			EventCounters: {
				UnauthorizedMessage: 0,
				TotalLink: 0
			}
		}
		await set(ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}`), User)
	}

	async UpdateTopic(ChatTitle, Username, TopicName, TopicID) {
		console.log(`Update Topic: @${Username}`)

		await set(ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}/Topic`), { Name: TopicName, ID: TopicID })
	}

	async DeleteUser(ChatTitle, Username) {
		console.log(`Left member: @${Username}`)

		let RefData = ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}/InGroup`)
		await set(RefData, false)
	}

	async ReturnUser(ChatTitle, Username) {
		console.log(`Return member: @${Username}`)
		await set(ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}/InGroup`), true)
	}

	async GetUser(ChatTitle, Username) {
		let RefData = ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}`)

		let User
		await get(RefData).then((Data) => { User = Data.val() })
		return User
	}

	async ImcreaseUnauthorizedMessage(ChatTitle, Username) {
		console.log(`Unauthorized message: @${Username}`)

		let RefData = ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}/EventCounters/UnauthorizedMessage`)

		let UnauthorizedMessage
		await get(RefData).then((Data) => { UnauthorizedMessage = Data.val() })
		await set(RefData, (UnauthorizedMessage == null) ? 1 : ++UnauthorizedMessage)
	}

	async ImcreaseTotalLink(ChatTitle, Username) {
		console.log(`New link: @${Username}`)

		let RefData = ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}/EventCounters/TotalLink`)

		let TotalLink
		await get(RefData).then((Data) => { TotalLink = Data.val() })
		await set(RefData, (TotalLink == null) ? 1 : ++TotalLink)
	}

	async AddNewLink(ChatTitle, Username, NewMessageID, NewURL) {
		let RefData = ref(DB, `SuperGroups/${ChatTitle}/Users/${Username}/Sprints/${GetNameActualSprint()}/Links`)

		let Result = { IsFirstLink: false, NumberLinksExceeded: false, LinkAlreadyExist: false, NumberLinks: 0 }

		let Links
		await get(RefData).then((Data) => { Links = Data.val() })

		if (Links == null) {
			Links = [{ URL: NewURL, MessageID: NewMessageID }]
			this.ImcreaseTotalLink(ChatTitle, Username)
			Result.IsFirstLink = true
		}
		else if (Links.length > 2)
			Result.NumberLinksExceeded = true
		else {
			let CheckExsist = false
			Links.forEach((Link) => { (Link.URL == NewURL) ? CheckExsist = true : {} })
			if (CheckExsist)
				Result.LinkAlreadyExist = true
			else {
				Links.push({ URL: NewURL, MessageID: NewMessageID })
				this.ImcreaseTotalLink(ChatTitle, Username)
				Result.NumberLinks = Links.length
			}
		}

		set(RefData, Links)

		console.log(`Total link in this sprint @${Username}: ${Links.length}`)

		return Result
	}

	async GetAllGroups() {
		let AllGroups
		await get(ref(DB, `SuperGroups`)).then((Data) => { AllGroups = Data.val() })
		return AllGroups
	}
}
module.exports = new Database()
