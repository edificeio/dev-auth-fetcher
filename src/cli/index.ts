import { Command } from 'commander';
import { runOnboardCommand } from './commands/onboard';
import { runConnectCommand } from './commands/connect';

const program = new Command();

program
  .name('dev-auth-fetcher')
  .description(
    "CLI pour connecter un environnement local aux environnements de recette et injecter les cookies d'authentification dans les fichiers .env des frontends.",
  )
  .version('0.1.0');

program
  .command('onboard')
  .description('Initialiser la configuration des applications et des environnements.')
  .action(async () => {
    await runOnboardCommand();
  });

program
  .command('connect')
  .description(
    "Se connecter à un environnement de recette et injecter les cookies dans les .env des applications front.",
  )
  .option('-e, --env <id>', "Identifiant de l'environnement (ex: recette-ode1)")
  .option('-a, --app <name>', "Nom de l'application cible")
  .option('--all', 'Cibler toutes les applications détectées')
  .option('-l, --login <login>', "Login de l'utilisateur à utiliser")
  .action(async (options) => {
    await runConnectCommand(options);
  });

program.parseAsync(process.argv).catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Erreur lors de lexécution de la CLI :', error);
  process.exit(1);
});

