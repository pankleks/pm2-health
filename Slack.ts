import { IncomingWebhook, IncomingWebhookSendArguments, MessageAttachment } from '@slack/client';

export interface ISlackConfig {
	slack: {
		username?: string;
		channel?: string;
		webhook?: string;
		disabled: boolean;
	}
}

export interface SlackFormatOptions {
	code?: boolean,
	bold?: boolean,
	italics?: boolean,
	strikethrough?: boolean,
}

class Slack {
	private _webhook: IncomingWebhook;

	constructor(private _config: ISlackConfig) {
		if (!this._config.slack)
			this._config.slack = { disabled: true };

		if (this._config.slack.disabled === true)
			return;

		if (!this._config.slack.username)
			this._config.slack.username = 'pm2-health';

		if (!this._config.slack.channel)
			throw new Error('[slack.channel] not set');
		if (!this._config.slack.webhook)
			throw new Error('[slack.webhook] not set');

		this._webhook = new IncomingWebhook(this._config.slack.webhook);
	}

	async send(subject: string, attachments: MessageAttachment[] = []) {
		if (this._config.slack.disabled === true)
			return;
		const paylaod: IncomingWebhookSendArguments = {
			channel: this._config.slack.channel,
			username: this._config.slack.username,
			text: subject,
			icon_emoji: ':bar_chart:',
			attachments,
		};

		await this._webhook.send(paylaod);
	}

	/**
	 * Format function for message building, default formatting is Bold
	 */
	static format(txt: string, {
		code = false,
		bold = false,
		italics = false,
		strikethrough = false,
	}: SlackFormatOptions = { bold: true }
	) {
		if (code) txt = `\`${txt}\``;
		if (bold) txt = `*${txt}*`;
		if (italics) txt = `_${txt}_`;
		if (strikethrough) txt = `~${txt}~`;
		return txt;
	}
}