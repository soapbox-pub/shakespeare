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

      // Theme Section
      theme: 'Theme',
      themeDescription: 'Choose between light, dark, or system theme preference.',

      // Language Section
      language: 'Language',
      languageDescription: 'Select your preferred language for the interface.',

      // Language Options
      english: 'English',
      portuguese: 'Portuguese',
      chinese: 'Chinese',
      systemLanguage: 'System',

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
      aboutShakespeareSettings: 'About Shakespeare',
      aboutShakespeareSettingsDescription: 'Information about Shakespeare',

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

      // Project View Navigation
      chat: 'Chat',
      preview: 'Preview',
      code: 'Code',

      // Preview Pane
      projectPreview: 'Project Preview',
      buildProjectToSeePreview: 'Build your project to see the preview here',
      fileExplorer: 'File Explorer',
      fileEditor: 'File Editor',
      selectFileFromExplorer: 'Select a file from the explorer to edit',
      openFileExplorer: 'Open File Explorer',

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
      loginToNostrRequired: 'Log in to Nostr to use this provider',
      goToNostrSettings: 'Go to Nostr Settings',

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

      // About Settings
      aboutShakespeare: 'About Shakespeare',
      aboutShakespeareDescription: 'Information about Shakespeare',
      sourceCode: 'Source Code',
      viewOnGitLab: 'View on GitLab',
      description: 'Description',
      license: 'License',
      loadingLicense: 'Loading license...',
      failedToLoadLicense: 'Failed to load license',

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

      // Clone Page
      cloneGitRepository: 'Clone a Git repository into your Shakespeare workspace',
      pleaseEnterRepositoryUrl: 'Please enter a repository URL',
      pleaseEnterValidGitUrl: 'Please enter a valid Git repository URL or Nostr clone URI (e.g., nostr://npub.../repo-name)',
      cloningRepository: 'Cloning Repository...',
      nostrRepositoryImportedSuccessfully: 'Nostr repository imported successfully',
      repositoryClonedFromNostr: '"{{repoName}}" has been cloned from Nostr and is ready for development.',
      repositoryImportedSuccessfully: 'Repository imported successfully',
      repositoryClonedReady: '"{{repoName}}" has been cloned and is ready for development.',
      failedToImportRepository: 'Failed to import repository',
      repositoryNotFoundOnNostr: 'Repository not found on Nostr network. Please check the URI and try again.',
      noCloneUrlsFound: 'Repository announcement found but no clone URLs available.',
      allCloneAttemptsFailed: 'Repository found but all clone URLs failed. The repository may be unavailable.',
      repositoryNotFound: 'Repository not found. Please check the URL and try again.',
      accessDenied: 'Access denied. The repository may be private or require authentication.',
      networkError: 'Network error. Please check your connection and try again.',
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

      // Theme Section
      theme: 'Tema',
      themeDescription: 'Escolha entre preferência de tema claro, escuro ou do sistema.',

      // Language Section
      language: 'Idioma',
      languageDescription: 'Selecione seu idioma preferido para a interface.',

      // Language Options
      english: 'Inglês',
      portuguese: 'Português',
      chinese: 'Chinês',
      systemLanguage: 'Sistema',

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
      aboutShakespeareSettings: 'Sobre o Shakespeare',
      aboutShakespeareSettingsDescription: 'Informações sobre o Shakespeare',

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

      // Project View Navigation
      chat: 'Chat',
      preview: 'Visualização',
      code: 'Código',

      // Preview Pane
      projectPreview: 'Visualização do Projeto',
      buildProjectToSeePreview: 'Construa seu projeto para ver a visualização aqui',
      fileExplorer: 'Explorador de Arquivos',
      fileEditor: 'Editor de Arquivos',
      selectFileFromExplorer: 'Selecione um arquivo do explorador para editar',
      openFileExplorer: 'Abrir Explorador de Arquivos',

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
      loginToNostrRequired: 'Faça login no Nostr para usar este provedor',
      goToNostrSettings: 'Ir para Configurações do Nostr',

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

      // About Settings
      aboutShakespeare: 'Sobre o Shakespeare',
      aboutShakespeareDescription: 'Informações sobre o Shakespeare.',
      sourceCode: 'Código-fonte',
      viewOnGitLab: 'Ver no GitLab',
      description: 'Descrição',
      license: 'Licença',
      loadingLicense: 'Carregando licença...',
      failedToLoadLicense: 'Falha ao carregar licença',

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

      // Clone Page
      cloneGitRepository: 'Clone um repositório Git para seu workspace Shakespeare',
      pleaseEnterRepositoryUrl: 'Por favor, digite uma URL do repositório',
      pleaseEnterValidGitUrl: 'Por favor, digite uma URL válida de repositório Git ou URI de clone Nostr (ex: nostr://npub.../nome-repo)',
      cloningRepository: 'Clonando Repositório...',
      nostrRepositoryImportedSuccessfully: 'Repositório Nostr importado com sucesso',
      repositoryClonedFromNostr: '"{{repoName}}" foi clonado do Nostr e está pronto para desenvolvimento.',
      repositoryImportedSuccessfully: 'Repositório importado com sucesso',
      repositoryClonedReady: '"{{repoName}}" foi clonado e está pronto para desenvolvimento.',
      failedToImportRepository: 'Falha ao importar repositório',
      repositoryNotFoundOnNostr: 'Repositório não encontrado na rede Nostr. Verifique a URI e tente novamente.',
      noCloneUrlsFound: 'Anúncio do repositório encontrado, mas nenhuma URL de clone disponível.',
      allCloneAttemptsFailed: 'Repositório encontrado, mas todas as URLs de clone falharam. O repositório pode estar indisponível.',
      repositoryNotFound: 'Repositório não encontrado. Verifique a URL e tente novamente.',
      accessDenied: 'Acesso negado. O repositório pode ser privado ou requer autenticação.',
      networkError: 'Erro de rede. Verifique sua conexão e tente novamente.',
    }
  },
  zh: {
    translation: {
      // Navigation and Layout
      preferences: '偏好设置',
      settings: '设置',
      backToSettings: '返回设置',
      help: '帮助',
      anonymous: '匿名',

      // Authentication
      logIn: '登录',
      signUp: '注册',

      // Preferences Page
      preferencesDescription: '管理您的应用程序偏好设置和外观设置。',

      // Theme Section
      theme: '主题',
      themeDescription: '选择浅色、深色或系统主题偏好。',

      // Language Section
      language: '语言',
      languageDescription: '选择您的界面首选语言。',

      // Language Options
      english: 'English',
      portuguese: 'Português',
      chinese: '中文',
      systemLanguage: '系统',

      // Theme Options
      light: '浅色',
      dark: '深色',
      system: '系统',

      // Common UI Elements
      save: '保存',
      cancel: '取消',
      close: '关闭',
      open: '打开',
      edit: '编辑',
      delete: '删除',
      create: '创建',
      update: '更新',
      loading: '加载中...',
      error: '错误',
      success: '成功',
      warning: '警告',
      info: '信息',
      add: '添加',
      remove: '移除',
      retry: '重试',

      // Shakespeare Main Page
      buildNostrApps: '使用AI构建Nostr应用',
      whatToBuild: '您想构建什么？',
      createProject: '创建项目',
      generating: '生成中...',
      creating: '创建中...',
      chooseModel: '选择模型...',
      selectModelToDescribe: "请在下方选择一个模型，然后描述您想要构建的内容...",
      examplePrompt: "例如：为当地农民创建一个农业设备市场，用于买卖拖拉机、工具和用品...",

      // Settings Page
      settingsDescription: '管理您的应用程序设置和偏好。',
      aiSettings: 'AI设置',
      aiSettingsDescription: '配置AI提供商和API密钥',
      gitSettings: 'Git设置',
      gitSettingsDescription: '配置HTTP身份验证的Git凭据',
      nostrSettings: 'Nostr设置',
      nostrSettingsDescription: '配置中继连接和Nostr偏好',
      dataSettings: '数据',
      dataSettingsDescription: '导出文件和管理本地数据',
      aboutShakespeareSettings: '关于Shakespeare',
      aboutShakespeareSettingsDescription: '关于Shakespeare的信息',

      // Project Sidebar
      newProject: '新项目',
      importRepository: '导入仓库',
      noProjectsYet: '还没有项目',
      createFirstProject: '创建您的第一个项目开始使用',
      closeSidebar: '关闭侧边栏',
      collapseSidebar: '折叠侧边栏',

      // Chat Interface
      welcomeToShakespeare: '欢迎使用Shakespeare',
      aiAssistantReady: '您的AI驱动开发助手已准备好帮助您构建、编辑和增强您的项目。',
      askMeFeatures: '💡 请我添加新功能',
      requestEdits: '📝 请求文件编辑和改进',
      getHelp: '🔧 获得调试和优化帮助',
      buildDeploy: '🚀 构建和部署您的项目',
      aiNotConfigured: 'AI助手未配置',
      configureAI: '请配置您的AI设置以开始使用AI助手构建。',
      useMenuForAI: '使用顶部栏中的菜单访问AI设置。',
      askToAddFeatures: '请我添加功能、编辑文件或构建您的项目...',
      selectModelFirst: '请先选择一个模型开始聊天...',
      sendMessage: '发送消息',
      stopGeneration: '停止生成',
      running: '运行中',

      // Project View Navigation
      chat: '聊天',
      preview: '预览',
      code: '代码',

      // Preview Pane
      projectPreview: '项目预览',
      buildProjectToSeePreview: '构建您的项目以在此处查看预览',
      fileExplorer: '文件浏览器',
      fileEditor: '文件编辑器',
      selectFileFromExplorer: '从浏览器中选择一个文件进行编辑',
      openFileExplorer: '打开文件浏览器',

      // File Editor
      unsavedChanges: '未保存的更改',
      saving: '保存中...',
      languageLabel: '语言',

      // File Tree
      searchFiles: '搜索文件...',
      noFilesFound: '未找到文件',
      noFilesFoundSearch: '未找到与您搜索匹配的文件',

      // Git Dialog
      gitRepositoryStatus: 'Git仓库状态',
      repositoryStatusDescription: '查看仓库状态并与远程仓库同步',
      repositoryInformation: '仓库信息',
      currentBranch: '当前分支',
      totalCommits: '总提交数',
      latestCommit: '最新提交',
      remotes: '远程仓库',
      notGitRepository: '不是Git仓库',
      gitAuthentication: '身份验证',
      credentialsDescription: '推送/拉取操作的凭据',
      configured: '已配置',
      noCredentials: '无凭据',
      noCredentialsWarning: '未为{{provider}}配置凭据。私有仓库的推送/拉取操作可能失败。',
      configureCredentials: '配置凭据',
      syncStatus: '同步状态',
      pull: '拉取',
      push: '推送',
      pulling: '拉取中...',
      pushing: '推送中...',
      upToDate: '已是最新',
      commitsAhead: '领先{{count}}个提交',
      commitsBehind: '落后{{count}}个提交',
      uncommittedChanges: '{{count}}个未提交的更改',
      noRemoteConfigured: '未配置远程仓库',
      workingDirectoryChanges: '工作目录更改',
      filesWithChanges: '{{count}}个文件有更改',
      workingDirectoryClean: '工作目录干净',
      noUncommittedChanges: '无未提交的更改',
      cannotPush: '无法推送',
      cannotPull: '无法拉取',
      notGitRepoOrBranch: '不是git仓库或无当前分支',
      noRemoteRepositories: '未配置远程仓库',
      nothingToPush: '无内容可推送',
      noCommitsAhead: '没有领先远程的提交。请先提交您的更改。',
      pushSuccessful: '推送成功',
      pushFailed: '推送失败',
      pullSuccessful: '拉取成功',
      pullFailed: '拉取失败',

      // AI Settings
      aiSettingsDescriptionLong: '通过添加您的API密钥来配置AI提供商。设置会自动保存并存储在您的浏览器本地。',
      configuredProviders: '已配置的提供商',
      addProvider: '添加提供商',
      getApiKey: '获取API密钥',
      getToken: '获取令牌',
      enterApiKey: '输入您的API密钥',
      enterToken: '输入您的令牌',
      enterCashuToken: '输入Cashu令牌',
      addCustomProvider: '添加自定义提供商',
      providerName: '提供商名称',
      baseUrl: '基础URL',
      apiKey: 'API密钥',
      authentication: '身份验证',
      addCustomProviderButton: '添加自定义提供商',
      providerExists: '此名称的提供商已存在',
      custom: '自定义',
      connecting: '连接中...',
      connectToGitHub: '连接到GitHub',
      loginToNostrRequired: '登录Nostr以使用此提供商',
      goToNostrSettings: '前往Nostr设置',

      // Git Settings
      gitSettingsDescriptionLong: '配置HTTP身份验证的Git凭据。设置会自动保存并存储在您的浏览器本地。',
      configuredCredentials: '已配置的凭据',
      origin: '源',
      username: '用户名',
      password: '密码',
      enterPassword: '输入您的密码/令牌',
      credentialsExist: '此源的凭据已存在',
      corsProxy: 'CORS代理',
      corsProxyDescription: '用于所有与远程仓库的Git操作的CORS代理服务器。浏览器基于的Git操作必需。',

      // Data Settings
      dataSettingsDescriptionLong: '导出文件和管理本地数据。',
      exportFiles: '导出文件',
      exportFilesDescription: '将您的所有项目和文件下载为ZIP存档。这包括所有项目文件、设置和本地存储的数据。',
      exportAllFiles: '导出所有文件',
      exporting: '导出中...',
      clearAllData: '清除所有数据',
      clearAllDataDescription: '永久删除所有本地数据，包括项目、设置和缓存信息。此操作无法撤销。',
      clearing: '清除中...',
      areYouSure: '您确定吗？',
      clearDataWarning: '此操作将永久删除此浏览器的所有本地数据，包括：',
      allProjects: '所有项目及其文件',
      aiSettingsAndKeys: 'AI设置和API密钥',
      gitCredentialsSettings: 'Git凭据和设置',
      userPreferences: '用户偏好和主题',
      cachedData: '缓存数据和会话信息',
      actionCannotBeUndone: '此操作无法撤销。请考虑先导出您的文件。',
      yesClearAllData: '是的，清除所有数据',
      used: '已使用',
      available: '可用',
      usagePercentage: '已使用{{percentage}}%',
      usageUnavailable: '使用百分比不可用',
      loadingStorageInfo: '加载存储信息...',
      filesExportedSuccessfully: '文件导出成功',
      filesExportedDescription: '您的项目文件已下载为zip文件。',
      failedToExportFiles: '导出文件失败',
      dataClearedSuccessfully: '数据清除成功',
      dataClearedDescription: '所有本地数据已删除。正在重定向到主页...',
      failedToClearData: '清除数据失败',

      // About Settings
      aboutShakespeare: '关于Shakespeare',
      aboutShakespeareDescription: '关于Shakespeare的信息。',
      sourceCode: '源代码',
      viewOnGitLab: '在GitLab上查看',
      description: '描述',
      license: '许可证',
      loadingLicense: '加载许可证中...',
      failedToLoadLicense: '加载许可证失败',

      // 404 Page
      pageNotFound: '哎呀！页面未找到',
      returnToHome: '返回首页',

      // Model Selector
      selectOrEnterModel: '选择或输入模型...',
      searchModels: '搜索模型...',
      enterCustomModel: '输入自定义模型...',
      manageProviders: '管理提供商...',
      noModelsFound: '未找到模型。',
      tryCustomModel: '尝试使用自定义模型。',
      recentlyUsed: '最近使用',
      errorLoadingModels: '加载模型时出错',

      // Context and Cost
      contextUsage: '上下文使用：{{tokens}} / {{total}} 令牌 ({{percentage}}%)',
      totalCostSession: '此聊天会话的总费用',

      // File Status
      added: '已添加',
      deleted: '已删除',
      modified: '已修改',
      staged: '已暂存',
      untracked: '未跟踪',

      // Settings Layout
      toggleSidebar: '切换侧边栏',
      openSidebar: '打开侧边栏',

      // Nostr Settings
      nostrSettingsDescriptionLong: '配置您的Nostr连接设置和中继偏好。',
      nostrAccounts: 'Nostr账户',
      noAccountsLoggedIn: '没有账户登录。添加账户开始使用。',
      createAccount: '创建账户',
      addExistingAccount: '添加现有账户',
      addAccount: '添加账户',
      relayConfiguration: '中继配置',
      selectedRelay: '选定的中继',

      // Clone Page
      cloneGitRepository: '将Git仓库克隆到您的Shakespeare工作空间',
      pleaseEnterRepositoryUrl: '请输入仓库URL',
      pleaseEnterValidGitUrl: '请输入有效的Git仓库URL或Nostr克隆URI（例如：nostr://npub.../仓库名）',
      cloningRepository: '正在克隆仓库...',
      nostrRepositoryImportedSuccessfully: 'Nostr仓库导入成功',
      repositoryClonedFromNostr: '"{{repoName}}"已从Nostr克隆并准备好进行开发。',
      repositoryImportedSuccessfully: '仓库导入成功',
      repositoryClonedReady: '"{{repoName}}"已克隆并准备好进行开发。',
      failedToImportRepository: '导入仓库失败',
      repositoryNotFoundOnNostr: '在Nostr网络上未找到仓库。请检查URI并重试。',
      noCloneUrlsFound: '找到仓库公告但没有可用的克隆URL。',
      allCloneAttemptsFailed: '找到仓库但所有克隆URL都失败了。仓库可能不可用。',
      repositoryNotFound: '未找到仓库。请检查URL并重试。',
      accessDenied: '访问被拒绝。仓库可能是私有的或需要身份验证。',
      networkError: '网络错误。请检查您的连接并重试。',
    }
  }
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    }
  });

export default i18n;