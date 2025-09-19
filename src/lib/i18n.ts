import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation and Layout
      preferences: 'Preferences',
      settings: 'Settings',
      backToSettings: 'Back to Settings',
      help: 'Help',
      anonymous: 'Anonymous',

      // Authentication
      logIn: 'Log in',
      signUp: 'Sign up',

      // Preferences Page
      preferencesDescription: 'Manage your general application preferences and appearance settings.',

      // Appearance Section
      appearance: 'Appearance',
      appearanceDescription: 'Customize how the application looks and feels.',
      theme: 'Theme',
      themeDescription: 'Choose between light, dark, or system theme preference.',

      // Language Section
      language: 'Language',
      languageDescription: 'Select your preferred language for the interface.',

      // Language Options
      english: 'English',
      portuguese: 'Portuguese',

      // Theme Options
      light: 'Light',
      dark: 'Dark',
      system: 'System',

      // Common UI Elements
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      open: 'Open',
      edit: 'Edit',
      delete: 'Delete',
      create: 'Create',
      update: 'Update',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Information',
      add: 'Add',
      remove: 'Remove',
      retry: 'Retry',

      // Shakespeare Main Page
      buildNostrApps: 'Build Nostr apps with AI',
      whatToBuild: 'What would you like to build?',
      createProject: 'Create Project',
      generating: 'Generating...',
      creating: 'Creating...',
      chooseModel: 'Choose a model...',
      selectModelToDescribe: "Please select a model below, then describe what you'd like to build...",
      examplePrompt: "e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies...",

      // Settings Page
      settingsDescription: 'Manage your application settings and preferences.',
      aiSettings: 'AI Settings',
      aiSettingsDescription: 'Configure AI providers and API keys',
      gitSettings: 'Git Settings',
      gitSettingsDescription: 'Configure Git credentials for HTTP authentication',
      nostrSettings: 'Nostr Settings',
      nostrSettingsDescription: 'Configure relay connections and Nostr preferences',
      dataSettings: 'Data',
      dataSettingsDescription: 'Export files and manage local data',

      // Project Sidebar
      newProject: 'New Project',
      importRepository: 'Import Repository',
      noProjectsYet: 'No projects yet',
      createFirstProject: 'Create your first project to get started',
      closeSidebar: 'Close sidebar',
      collapseSidebar: 'Collapse sidebar',

      // Chat Interface
      welcomeToShakespeare: 'Welcome to Shakespeare',
      aiAssistantReady: 'Your AI-powered development assistant is ready to help you build, edit, and enhance your project.',
      askMeFeatures: '💡 Ask me to add new features',
      requestEdits: '📝 Request file edits and improvements',
      getHelp: '🔧 Get help with debugging and optimization',
      buildDeploy: '🚀 Build and deploy your project',
      aiNotConfigured: 'AI Assistant Not Configured',
      configureAI: 'Please configure your AI settings to start building with AI assistance.',
      useMenuForAI: 'Use the menu in the top bar to access AI Settings.',
      askToAddFeatures: 'Ask me to add features, edit files, or build your project...',
      selectModelFirst: 'Please select a model to start chatting...',
      sendMessage: 'Send message',
      stopGeneration: 'Stop generation',
      running: 'Running',

      // File Editor
      unsavedChanges: 'Unsaved changes',
      saving: 'Saving...',
      languageLabel: 'Language',

      // File Tree
      searchFiles: 'Search files...',
      noFilesFound: 'No files found',
      noFilesFoundSearch: 'No files found matching your search',

      // Git Dialog
      gitRepositoryStatus: 'Git Repository Status',
      repositoryStatusDescription: 'View repository status and sync with remote repositories',
      repositoryInformation: 'Repository Information',
      currentBranch: 'Current Branch',
      totalCommits: 'Total Commits',
      latestCommit: 'Latest Commit',
      remotes: 'Remotes',
      notGitRepository: 'Not a Git repository',
      gitAuthentication: 'Authentication',
      credentialsDescription: 'Credentials for push/pull operations',
      configured: 'Configured',
      noCredentials: 'No credentials',
      noCredentialsWarning: 'No credentials configured for {{provider}}. Push/pull operations may fail for private repositories.',
      configureCredentials: 'Configure credentials',
      syncStatus: 'Sync Status',
      pull: 'Pull',
      push: 'Push',
      pulling: 'Pulling...',
      pushing: 'Pushing...',
      upToDate: 'Up to date',
      commitsAhead: '{{count}} commit ahead | {{count}} commits ahead',
      commitsBehind: '{{count}} commit behind | {{count}} commits behind',
      uncommittedChanges: '{{count}} uncommitted change | {{count}} uncommitted changes',
      noRemoteConfigured: 'No remote configured',
      workingDirectoryChanges: 'Working Directory Changes',
      filesWithChanges: '{{count}} file with changes | {{count}} files with changes',
      workingDirectoryClean: 'Working directory is clean',
      noUncommittedChanges: 'No uncommitted changes',
      cannotPush: 'Cannot push',
      cannotPull: 'Cannot pull',
      notGitRepoOrBranch: 'Not a git repository or no current branch',
      noRemoteRepositories: 'No remote repositories configured',
      nothingToPush: 'Nothing to push',
      noCommitsAhead: 'No commits ahead of remote. Commit your changes first.',
      pushSuccessful: 'Push successful',
      pushFailed: 'Push failed',
      pullSuccessful: 'Pull successful',
      pullFailed: 'Pull failed',

      // AI Settings
      aiSettingsDescriptionLong: 'Configure AI providers by adding your API keys. Settings are automatically saved and stored locally in your browser.',
      configuredProviders: 'Configured Providers',
      addProvider: 'Add Provider',
      getApiKey: 'Get API key',
      getToken: 'Get token',
      enterApiKey: 'Enter your API key',
      enterToken: 'Enter your token',
      enterCashuToken: 'Enter a Cashu token',
      addCustomProvider: 'Add Custom Provider',
      providerName: 'Provider Name',
      baseUrl: 'Base URL',
      apiKey: 'API Key',
      authentication: 'Authentication',
      addCustomProviderButton: 'Add Custom Provider',
      providerExists: 'Provider with this name already exists',
      custom: 'Custom',
      connecting: 'Connecting...',
      connectToGitHub: 'Connect to GitHub',

      // Git Settings
      gitSettingsDescriptionLong: 'Configure Git credentials for HTTP authentication. Settings are automatically saved and stored locally in your browser.',
      configuredCredentials: 'Configured Credentials',
      origin: 'Origin',
      username: 'Username',
      password: 'Password',
      enterPassword: 'Enter your password/token',
      credentialsExist: 'Credentials for this origin already exist',
      corsProxy: 'CORS Proxy',
      corsProxyDescription: 'CORS proxy server used for all Git operations with remote repositories. Required for browser-based Git operations.',

      // Data Settings
      dataSettingsDescriptionLong: 'Export files and manage local data.',
      exportFiles: 'Export Files',
      exportFilesDescription: 'Download all your projects and files as a ZIP archive. This includes all project files, settings, and data stored locally.',
      exportAllFiles: 'Export All Files',
      exporting: 'Exporting...',
      clearAllData: 'Clear All Data',
      clearAllDataDescription: 'Permanently delete all local data including projects, settings, and cached information. This action cannot be undone.',
      clearing: 'Clearing...',
      areYouSure: 'Are you absolutely sure?',
      clearDataWarning: 'This action will permanently delete all local data from this browser, including:',
      allProjects: 'All projects and their files',
      aiSettingsAndKeys: 'AI settings and API keys',
      gitCredentialsSettings: 'Git credentials and settings',
      userPreferences: 'User preferences and themes',
      cachedData: 'Cached data and session information',
      actionCannotBeUndone: 'This action cannot be undone. Consider exporting your files first.',
      yesClearAllData: 'Yes, clear all data',
      used: 'Used',
      available: 'Available',
      usagePercentage: '{{percentage}}% used',
      usageUnavailable: 'Usage percentage unavailable',
      loadingStorageInfo: 'Loading storage information...',
      filesExportedSuccessfully: 'Files exported successfully',
      filesExportedDescription: 'Your project files have been downloaded as a zip file.',
      failedToExportFiles: 'Failed to export files',
      dataClearedSuccessfully: 'Data cleared successfully',
      dataClearedDescription: 'All local data has been removed. Redirecting to homepage...',
      failedToClearData: 'Failed to clear data',

      // 404 Page
      pageNotFound: 'Oops! Page not found',
      returnToHome: 'Return to Home',

      // Model Selector
      selectOrEnterModel: 'Select or enter a model...',
      searchModels: 'Search models...',
      enterCustomModel: 'Enter custom model...',
      manageProviders: 'Manage providers...',
      noModelsFound: 'No models found.',
      tryCustomModel: 'Try using a custom model instead.',
      recentlyUsed: 'Recently Used',
      errorLoadingModels: 'Error Loading Models',

      // Context and Cost
      contextUsage: 'Context usage: {{tokens}} / {{total}} tokens ({{percentage}}%)',
      totalCostSession: 'Total cost for this chat session',

      // File Status
      added: 'added',
      deleted: 'deleted',
      modified: 'modified',
      staged: 'staged',
      untracked: 'untracked',

      // Settings Layout
      toggleSidebar: 'Toggle sidebar',
      openSidebar: 'Open sidebar',

      // Nostr Settings
      nostrSettingsDescriptionLong: 'Configure your Nostr connection settings and relay preferences.',
      nostrAccounts: 'Nostr Accounts',
      noAccountsLoggedIn: 'No accounts logged in. Add an account to get started.',
      createAccount: 'Create Account',
      addExistingAccount: 'Add Existing Account',
      addAccount: 'Add Account',
      relayConfiguration: 'Relay Configuration',
      selectedRelay: 'Selected Relay',
    }
  },
  pt: {
    translation: {
      // Navigation and Layout
      preferences: 'Preferências',
      settings: 'Configurações',
      backToSettings: 'Voltar às Configurações',
      help: 'Ajuda',
      anonymous: 'Anônimo',

      // Authentication
      logIn: 'Entrar',
      signUp: 'Cadastrar',

      // Preferences Page
      preferencesDescription: 'Gerencie suas preferências gerais da aplicação e configurações de aparência.',

      // Appearance Section
      appearance: 'Aparência',
      appearanceDescription: 'Personalize como a aplicação se parece e funciona.',
      theme: 'Tema',
      themeDescription: 'Escolha entre preferência de tema claro, escuro ou do sistema.',

      // Language Section
      language: 'Idioma',
      languageDescription: 'Selecione seu idioma preferido para a interface.',

      // Language Options
      english: 'Inglês',
      portuguese: 'Português',

      // Theme Options
      light: 'Claro',
      dark: 'Escuro',
      system: 'Sistema',

      // Common UI Elements
      save: 'Salvar',
      cancel: 'Cancelar',
      close: 'Fechar',
      open: 'Abrir',
      edit: 'Editar',
      delete: 'Excluir',
      create: 'Criar',
      update: 'Atualizar',
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso',
      warning: 'Aviso',
      info: 'Informação',
      add: 'Adicionar',
      remove: 'Remover',
      retry: 'Tentar novamente',

      // Shakespeare Main Page
      buildNostrApps: 'Construa aplicativos Nostr com IA',
      whatToBuild: 'O que você gostaria de construir?',
      createProject: 'Criar Projeto',
      generating: 'Gerando...',
      creating: 'Criando...',
      chooseModel: 'Escolha um modelo...',
      selectModelToDescribe: "Por favor, selecione um modelo abaixo e depois descreva o que gostaria de construir...",
      examplePrompt: "ex., Criar um marketplace de equipamentos agrícolas para fazendeiros locais comprarem e venderem tratores, ferramentas e suprimentos...",

      // Settings Page
      settingsDescription: 'Gerencie as configurações e preferências da aplicação.',
      aiSettings: 'Configurações de IA',
      aiSettingsDescription: 'Configure provedores de IA e chaves de API',
      gitSettings: 'Configurações do Git',
      gitSettingsDescription: 'Configure credenciais do Git para autenticação HTTP',
      nostrSettings: 'Configurações do Nostr',
      nostrSettingsDescription: 'Configure conexões de relay e preferências do Nostr',
      dataSettings: 'Dados',
      dataSettingsDescription: 'Exporte arquivos e gerencie dados locais',

      // Project Sidebar
      newProject: 'Novo Projeto',
      importRepository: 'Importar Repositório',
      noProjectsYet: 'Nenhum projeto ainda',
      createFirstProject: 'Crie seu primeiro projeto para começar',
      closeSidebar: 'Fechar barra lateral',
      collapseSidebar: 'Recolher barra lateral',

      // Chat Interface
      welcomeToShakespeare: 'Bem-vindo ao Shakespeare',
      aiAssistantReady: 'Seu assistente de desenvolvimento com IA está pronto para ajudá-lo a construir, editar e aprimorar seu projeto.',
      askMeFeatures: '💡 Peça para adicionar novos recursos',
      requestEdits: '📝 Solicite edições e melhorias de arquivos',
      getHelp: '🔧 Obtenha ajuda com depuração e otimização',
      buildDeploy: '🚀 Construa e implante seu projeto',
      aiNotConfigured: 'Assistente de IA Não Configurado',
      configureAI: 'Configure suas configurações de IA para começar a construir com assistência de IA.',
      useMenuForAI: 'Use o menu na barra superior para acessar as Configurações de IA.',
      askToAddFeatures: 'Peça para adicionar recursos, editar arquivos ou construir seu projeto...',
      selectModelFirst: 'Selecione um modelo para começar a conversar...',
      sendMessage: 'Enviar mensagem',
      stopGeneration: 'Parar geração',
      running: 'Executando',

      // File Editor
      unsavedChanges: 'Alterações não salvas',
      saving: 'Salvando...',
      languageLabel: 'Linguagem',

      // File Tree
      searchFiles: 'Buscar arquivos...',
      noFilesFound: 'Nenhum arquivo encontrado',
      noFilesFoundSearch: 'Nenhum arquivo encontrado correspondente à sua busca',

      // Git Dialog
      gitRepositoryStatus: 'Status do Repositório Git',
      repositoryStatusDescription: 'Visualizar status do repositório e sincronizar com repositórios remotos',
      repositoryInformation: 'Informações do Repositório',
      currentBranch: 'Branch Atual',
      totalCommits: 'Total de Commits',
      latestCommit: 'Último Commit',
      remotes: 'Remotos',
      notGitRepository: 'Não é um repositório Git',
      gitAuthentication: 'Autenticação',
      credentialsDescription: 'Credenciais para operações de push/pull',
      configured: 'Configurado',
      noCredentials: 'Sem credenciais',
      noCredentialsWarning: 'Nenhuma credencial configurada para {{provider}}. Operações de push/pull podem falhar para repositórios privados.',
      configureCredentials: 'Configurar credenciais',
      syncStatus: 'Status de Sincronização',
      pull: 'Pull',
      push: 'Push',
      pulling: 'Fazendo pull...',
      pushing: 'Fazendo push...',
      upToDate: 'Atualizado',
      commitsAhead: '{{count}} commit à frente | {{count}} commits à frente',
      commitsBehind: '{{count}} commit atrás | {{count}} commits atrás',
      uncommittedChanges: '{{count}} alteração não commitada | {{count}} alterações não commitadas',
      noRemoteConfigured: 'Nenhum remoto configurado',
      workingDirectoryChanges: 'Alterações do Diretório de Trabalho',
      filesWithChanges: '{{count}} arquivo com alterações | {{count}} arquivos com alterações',
      workingDirectoryClean: 'Diretório de trabalho limpo',
      noUncommittedChanges: 'Nenhuma alteração não commitada',
      cannotPush: 'Não é possível fazer push',
      cannotPull: 'Não é possível fazer pull',
      notGitRepoOrBranch: 'Não é um repositório git ou não há branch atual',
      noRemoteRepositories: 'Nenhum repositório remoto configurado',
      nothingToPush: 'Nada para fazer push',
      noCommitsAhead: 'Nenhum commit à frente do remoto. Faça commit de suas alterações primeiro.',
      pushSuccessful: 'Push realizado com sucesso',
      pushFailed: 'Push falhou',
      pullSuccessful: 'Pull realizado com sucesso',
      pullFailed: 'Pull falhou',

      // AI Settings
      aiSettingsDescriptionLong: 'Configure provedores de IA adicionando suas chaves de API. As configurações são salvas automaticamente e armazenadas localmente em seu navegador.',
      configuredProviders: 'Provedores Configurados',
      addProvider: 'Adicionar Provedor',
      getApiKey: 'Obter chave de API',
      getToken: 'Obter token',
      enterApiKey: 'Digite sua chave de API',
      enterToken: 'Digite seu token',
      enterCashuToken: 'Digite um token Cashu',
      addCustomProvider: 'Adicionar Provedor Personalizado',
      providerName: 'Nome do Provedor',
      baseUrl: 'URL Base',
      apiKey: 'Chave de API',
      authentication: 'Autenticação',
      addCustomProviderButton: 'Adicionar Provedor Personalizado',
      providerExists: 'Provedor com este nome já existe',
      custom: 'Personalizado',
      connecting: 'Conectando...',
      connectToGitHub: 'Conectar ao GitHub',

      // Git Settings
      gitSettingsDescriptionLong: 'Configure credenciais do Git para autenticação HTTP. As configurações são salvas automaticamente e armazenadas localmente em seu navegador.',
      configuredCredentials: 'Credenciais Configuradas',
      origin: 'Origem',
      username: 'Nome de usuário',
      password: 'Senha',
      enterPassword: 'Digite sua senha/token',
      credentialsExist: 'Credenciais para esta origem já existem',
      corsProxy: 'Proxy CORS',
      corsProxyDescription: 'Servidor proxy CORS usado para todas as operações Git com repositórios remotos. Necessário para operações Git baseadas no navegador.',

      // Data Settings
      dataSettingsDescriptionLong: 'Exporte arquivos e gerencie dados locais.',
      exportFiles: 'Exportar Arquivos',
      exportFilesDescription: 'Baixe todos os seus projetos e arquivos como um arquivo ZIP. Isso inclui todos os arquivos de projeto, configurações e dados armazenados localmente.',
      exportAllFiles: 'Exportar Todos os Arquivos',
      exporting: 'Exportando...',
      clearAllData: 'Limpar Todos os Dados',
      clearAllDataDescription: 'Exclua permanentemente todos os dados locais, incluindo projetos, configurações e informações em cache. Esta ação não pode ser desfeita.',
      clearing: 'Limpando...',
      areYouSure: 'Você tem certeza absoluta?',
      clearDataWarning: 'Esta ação excluirá permanentemente todos os dados locais deste navegador, incluindo:',
      allProjects: 'Todos os projetos e seus arquivos',
      aiSettingsAndKeys: 'Configurações de IA e chaves de API',
      gitCredentialsSettings: 'Credenciais e configurações do Git',
      userPreferences: 'Preferências do usuário e temas',
      cachedData: 'Dados em cache e informações de sessão',
      actionCannotBeUndone: 'Esta ação não pode ser desfeita. Considere exportar seus arquivos primeiro.',
      yesClearAllData: 'Sim, limpar todos os dados',
      used: 'Usado',
      available: 'Disponível',
      usagePercentage: '{{percentage}}% usado',
      usageUnavailable: 'Porcentagem de uso indisponível',
      loadingStorageInfo: 'Carregando informações de armazenamento...',
      filesExportedSuccessfully: 'Arquivos exportados com sucesso',
      filesExportedDescription: 'Seus arquivos de projeto foram baixados como um arquivo zip.',
      failedToExportFiles: 'Falha ao exportar arquivos',
      dataClearedSuccessfully: 'Dados limpos com sucesso',
      dataClearedDescription: 'Todos os dados locais foram removidos. Redirecionando para a página inicial...',
      failedToClearData: 'Falha ao limpar dados',

      // 404 Page
      pageNotFound: 'Ops! Página não encontrada',
      returnToHome: 'Voltar ao Início',

      // Model Selector
      selectOrEnterModel: 'Selecione ou digite um modelo...',
      searchModels: 'Buscar modelos...',
      enterCustomModel: 'Digite modelo personalizado...',
      manageProviders: 'Gerenciar provedores...',
      noModelsFound: 'Nenhum modelo encontrado.',
      tryCustomModel: 'Tente usar um modelo personalizado.',
      recentlyUsed: 'Usados Recentemente',
      errorLoadingModels: 'Erro ao Carregar Modelos',

      // Context and Cost
      contextUsage: 'Uso de contexto: {{tokens}} / {{total}} tokens ({{percentage}}%)',
      totalCostSession: 'Custo total para esta sessão de chat',

      // File Status
      added: 'adicionado',
      deleted: 'excluído',
      modified: 'modificado',
      staged: 'preparado',
      untracked: 'não rastreado',

      // Settings Layout
      toggleSidebar: 'Alternar barra lateral',
      openSidebar: 'Abrir barra lateral',

      // Nostr Settings
      nostrSettingsDescriptionLong: 'Configure suas configurações de conexão Nostr e preferências de relay.',
      nostrAccounts: 'Contas Nostr',
      noAccountsLoggedIn: 'Nenhuma conta logada. Adicione uma conta para começar.',
      createAccount: 'Criar Conta',
      addExistingAccount: 'Adicionar Conta Existente',
      addAccount: 'Adicionar Conta',
      relayConfiguration: 'Configuração de Relay',
      selectedRelay: 'Relay Selecionado',
    }
  }
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    }
  });

export default i18n;