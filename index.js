const { WPCampusRequestElement } = require("@wpcampus/wpcampus-wc-default");
const stylesheet = require("./index.css");

const loadingClass = "wpc-tweets--loading";
const postsSelector = "wpc-tweets__tweets";

class WPCampusTweets extends WPCampusRequestElement {
	constructor() {
		const config = {
			componentID: "tweets",
			localStorageKey: "wpcTweets",
			localStorageKeyTime: "wpcTweetsTime",
			requestURL: "https://wpcampus.org/wp-json/wpcampus/tweets"
		};
		super(config);

		this.addStyles(stylesheet);
	}
	getTweetDateFormat(dateObj) {
		const monthNames = ["January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"
		];
		return monthNames[dateObj.getMonth()] + " " + dateObj.getDate() + ", " + dateObj.getFullYear();
	}
	getTweetDateTimeFormat(dateObj) {

		// Start with day.
		let format = this.getTweetDateFormat(dateObj);

		if (!format) {
			return "";
		}

		// Add time.
		format += ", " + dateObj.getHours() + ":" + dateObj.getMinutes();

		return format;
	}
	normalizeTweetText(item) {
		let text = "";

		if (item.full_text) {
			text = item.full_text;
		} else if (item.text) {
			text = item.text;
		}

		if (!text) {
			return "";
		}

		// Look for hashtags.
		if (item.entities.hashtags) {
			//const allowedHashtags = ["WPCampus", "wordpress", "heweb", "HigherEd"];
			for (let i = 0; i < item.entities.hashtags.length; i++) {
				const hashtag = item.entities.hashtags[i];
				if (!hashtag.text) {
					continue;
				}
				const fullHashtag = `#${hashtag.text}`;
				const hashtagURL = "https://twitter.com/search?q=" + hashtag.text.toLowerCase();
				const hashtagMarkup = `<a href="${hashtagURL}">${fullHashtag}</a>`;
				text = text.replace(fullHashtag, hashtagMarkup);
			}
		}

		// Look for user mentions.
		if (item.entities.user_mentions) {
			for (let i = 0; i < item.entities.user_mentions.length; i++) {
				const user = item.entities.user_mentions[i];
				if (!user.screen_name) {
					continue;
				}
				const fullScreenName = `@${user.screen_name}`;
				const urlMarkup = `<a href="https://twitter.com/${user.screen_name}">${fullScreenName}</a>`;
				text = text.replace(fullScreenName, urlMarkup);
			}
		}

		// Replace URLs.
		if (item.entities.urls) {
			for (let i = 0; i < item.entities.urls.length; i++) {
				const url = item.entities.urls[i];
				if (!url.url) {
					continue;
				}
				const urlMarkup = `<a href="${url.expanded_url}">${url.display_url}</a>`;
				text = text.replace(url.url, urlMarkup);
			}
		}

		return text;
	}
	getTemplate(item) {

		// Get the tweet text.
		let tweetText = this.normalizeTweetText(item);
		if (!tweetText) {
			return "";
		}

		// Get the tweet ID.
		const tweetId = item.id_str;
		if (!tweetId) {
			return "";
		}

		// Get the handle.
		const tweetHandle = item.user.screen_name;
		if (!tweetHandle) {
			return "";
		}

		// Begin to create template.
		let template = "";

		// Add tweet link.
		if (item.created_at) {

			// Create formatted dates.
			const tweetDateObj = new Date(item.created_at);
			const tweetDate = this.getTweetDateFormat(tweetDateObj);
			const tweetDateTime = this.getTweetDateTimeFormat(tweetDateObj);

			// Create link.
			const link = `https://twitter.com/${tweetHandle}/status/${tweetId}`;
			const linkAriaLabel = `Tweet from ${tweetDateTime}`;

			// Add link to template.
			template += `<a class="wpc-tweets__link" href="${link}" aria-label="${linkAriaLabel}">${tweetDate}</a>`;

		}

		// Add the tweet before the link.
		template = `<p class="wpc-tweets__text">${tweetText}</p>` + template;

		// Wrap in dev.
		template = `<div class="wpc-tweets__tweet">${template}</div>`;

		return template;
	}
	getHTMLMarkup(content, loading) {
		const templateDiv = document.createElement("div");

		let markup = `<div class="${postsSelector}">${content}</div>`;

		markup = this.wrapTemplateArea(markup);
		markup = this.wrapTemplate(markup, true);

		templateDiv.innerHTML = markup;

		if (true === loading) {
			templateDiv
				.querySelector(this.getWrapperSelector())
				.classList.add(loadingClass);
		}

		return templateDiv.innerHTML;
	}
	async loadContentError() {

		const content = "<p class=\"wpc-component__error-message\">There was a problem loading the tweets.";

		const cssPrefix = this.getComponentCSSPrefix();
		this.classList.add(`${cssPrefix}--error`);

		this.innerHTML = this.getHTMLMarkup(content);

		return true;
	}
	loadContentHTML(content, loading) {
		const that = this;
		return new Promise((resolve, reject) => {
			if (!content || !content.length) {
				reject("There is no content to display.");
			}

			// Build new template.
			let newContent = "";

			// Get our limit of content.
			let contentLimit;
			if (that.limit !== undefined && that.limit > 0) {
				contentLimit = that.limit;
			} else {
				contentLimit = content.length;
			}

			for (let i = 0; i < contentLimit; i++) {
				let item = content[i];

				// Add to the rest of the messages.
				newContent += that.getTemplate(item);

			}

			if (!newContent) {
				return resolve(false);
			}

			// Wrap in global templates.
			// Only set loading if innerHTML is empty to begin with.
			let markup = that.getHTMLMarkup(newContent, loading && !that.innerHTML);

			if (!that.innerHTML) {

				// Load the markup.
				that.innerHTML = markup;

				if (true === loading) {
					setTimeout(() => {
						that
							.querySelector(that.getWrapperSelector())
							.classList.remove(loadingClass);
					}, 200);
				}

				return resolve(true);
			}

			// Get out of here if no message or the message is the same.
			let existingContent = that.querySelector(`.${postsSelector}`);
			if (newContent === existingContent.innerHTML) {
				return resolve(true);
			}

			// Get component wrapper.
			var componentDiv = that.querySelector(that.getWrapperSelector());

			that.fadeOut(componentDiv).then(() => {
				that.innerHTML = markup;
				that.fadeIn(componentDiv).then(() => {
					return resolve(true);
				});
			});
		});
	}
	async loadContentFromRequest() {
		const that = this;

		// Limit the number of requests we make. Can be reset by user activity.
		that.requestUpdateCount++;
		that.requestUpdateMax = that.checkPropertyNumber(
			that.requestUpdateMax,
			that.requestUpdateMaxDefault,
			true
		);

		if (that.requestUpdateCount > that.requestUpdateMax) {
			that.pauseTimer();
			return;
		}

		that.requestContent({ limitKey: "per_page" })
			.then((response) => {
				try {
					if (!response) {
						throw "The request had no response.";
					}

					// Convert string to object.
					const content = JSON.parse(response);

					that.loadContentHTML(content, true)
						.then((loaded) => {

							// This means the content was changed/updated.
							if (true === loaded) {
								that.storeLocalContent(content);
							}
						})
						.catch(() => {
							// @TODO what to do when the request doesn't work?
						});
				} catch (error) {
					// @TODO handle error
				}
			})
			.catch(() => {

				// If request didnt work, force load local content.
				that.loadContentFromLocal(true);
			})
			.finally(() => {
				that.setUpdateTimer();
			});
	}
	async render() {
		const that = this;
		super.render().then(() => {

			that.isRendering(true);

			that.setAttribute("role", "complementary");
			that.setAttribute("aria-live", "polite");
			that.setAttribute("aria-label", "Tweets");

			that.loadContent().then(() => {
				that.isRendering(false);
			});
		});
	}
	connectedCallback() {
		super.connectedCallback();
		this.render();
	}
}
customElements.define("wpcampus-tweets", WPCampusTweets);

module.exports = WPCampusTweets;
