// Import the functions you need from the SDKs you need
import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Collection, ComponentType, Interaction, PermissionsBitField, Role } from 'discord.js';
import { answeredCollection, unansweredCollection, db } from '../firestore';

var logger = require('winston');

const adminRoles = [
  '722446885423546420',
  '881371527273144330',
  '590690199554752523',
  '590693611151294464',
];

// Your web app's Firebase configuration
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fnfd')
    .setDescription('Add or see questions for the next FNFD.')
    .addSubcommand(new SlashCommandSubcommandBuilder()
      .setName("add")
      .setDescription("Add a question for the next FNFD!")
      .addStringOption(option =>
        option.setName('question')
          .setDescription('The question to add.')
          .setRequired(true)
      ))
    .addSubcommand(new SlashCommandSubcommandBuilder()
      .setName("list")
      .setDescription("Add a question for the next FNFD!")
      .addBooleanOption(option =>
        option.setName("answered")
          .setDescription("Return answered questions instead of unanswered.")
          .setRequired(false))),
  async execute(interaction: ChatInputCommandInteraction) {
    logger.info(`Command interaction: ${JSON.stringify(interaction.options.getSubcommand())}`);
    await interaction.deferReply();
    switch (interaction.options.getSubcommand()) {
      case 'list':
        _listQuestions(interaction);
        break;
      case 'add':
        _addQuestion(interaction);
        break;
      default:
        interaction.editReply(`Unknown subcommand ${interaction.options.getSubcommand()}`);
        break;
    }
  },
};

async function _addQuestion(interaction: ChatInputCommandInteraction) {
  var questionsData = {
    text: interaction.options.getString('question'),
    addedBy: {
      name: interaction.user.username,
      id: interaction.user.id,
    },
    added: new Date(),
  };
  await unansweredCollection.doc().set(questionsData).catch((error) => {
    logger.info(`Error executing document update: ${error}`);
    throw error;
  });
  await interaction.editReply(`${interaction.user.username} added question: ${questionsData.text}`)
}

async function _listQuestions(interaction: ChatInputCommandInteraction) {
  const getAnswered = interaction.options.getBoolean('answered');
  const query = (getAnswered ? answeredCollection : unansweredCollection).orderBy('added');
  const result = await query.get();
  const docs = result.docs;
  var answeredText = getAnswered ? "answered" : "current unanswered";
  await interaction.editReply(`Here are the ${answeredText} questions:\n`);
  if (docs.length == 0) {
    await interaction.editReply(`There are no ${answeredText} questions.`);
    return;
  }

  var index = 1;
  var output = "";
  var groupCount = 0;
  var answerRow = new ActionRowBuilder<ButtonBuilder>();
  var deleteRow = new ActionRowBuilder<ButtonBuilder>();

  for (var doc of docs) {
    var question = doc.data();
    var questionText = `\n${index}: ${question.addedBy?.name} asked: \`${question.text}\``;
    if (output.length + questionText.length > 2000 || groupCount >= 5) {
      await interaction.followUp({
        content: output,
        components: [answerRow, deleteRow],
      });
      output = "";
      groupCount = 0;
      answerRow = new ActionRowBuilder<ButtonBuilder>();
      deleteRow = new ActionRowBuilder<ButtonBuilder>();
    }
    output += questionText;
    answerRow.addComponents(
      new ButtonBuilder({
        custom_id: `answer-${doc.ref.path}`,
        label: `☑️ #${index}`,
        style: ButtonStyle.Primary,
      }),
    );
    deleteRow.addComponents(
      new ButtonBuilder({
        custom_id: `delete-${doc.ref.path}`,
        label: `🗑️ #${index}`,
        style: ButtonStyle.Danger,
      }));
    groupCount++;
    index++;
  }

  if (output.length > 0) {
    await interaction.followUp({
      content: output,
      components: [answerRow, deleteRow],
    });
  }

  // Respond to button presses to mark questions as answered or delete them.

  const filter = i => i.customId.startsWith("answer-") || i.customId.startsWith("delete-");
  const collector = interaction.channel.createMessageComponentCollector({
    filter: filter,
    time: 15000,
    componentType: ComponentType.Button
  });
  collector.on('collect', i => {
    var hasAdminPermissions = false;

    var roles: Collection<string, Role> = i.member.roles.valueOf() as Collection<string, Role>;
    roles.forEach((role, key) => {
      if (adminRoles.indexOf(role.id) >= 0) {
        hasAdminPermissions = true;
      }
    });
    if (!hasAdminPermissions) {
      i.reply({
        content: "You do not have admin permissions on FNFD questions.",
        ephemeral: true,
      });
      return;
    }

    if (i.customId.startsWith("answer-")) {
      _markAnswered(i);
      // } else if (i.customId.startsWith("delete-")) {
      //   _deleteQuestion(i);
    }
  });
}

async function _markAnswered(interaction: ButtonInteraction) {
  const docId = interaction.customId.replace('answer-', '');
  const docRef = db.doc(docId);
  const doc = await docRef.get();
  const question = doc.data();

  await answeredCollection.doc().set(question);
  // Delete the original question in unanswered.
  await docRef.delete();

  await interaction.reply(`${interaction.user.username} \`${question.text}\` as answered.`);
}

async function _deleteQuestion(interaction: ButtonInteraction) {
  const docId = interaction.customId.replace('delete-', '');
  const docRef = db.doc(docId);
  const doc = await docRef.get();
  const question = doc.data();

  await docRef.delete();

  await interaction.reply(`${interaction.user.username} deleted \`${question.text}\` for being a bad question.`)
}