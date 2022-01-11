import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { shipCharacters } from '../firestore';
var logger = require('winston');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bwbb')
    .setDescription('Generates a random Bed/Wed/Behead trio and also beheads Nellie.'),
  async execute(interaction: CommandInteraction) {
    var options = Object.keys(shipCharacters);
    var count = options.length;
    var indOne = indOne = Math.floor((Math.random() * count));
    var characters = [];
    var fileNames = [];
    while (characters.length < 3) {
      var ind = Math.floor((Math.random() * count));
      var character = options[ind];
      if (characters.indexOf(character) >= 0) {
        continue;
      }
      characters.push(character);
      fileNames.push(shipCharacters[character]);
    }
    fileNames.push(shipCharacters['Nellie Cochrane']);
    var text = `Bed/Wed/Behead:\n${characters[0]}\n${characters[1]}\n${characters[2]}\nBehead Nellie Cochrane`;
    await interaction.reply({ content: text, files: fileNames });
  },
};
