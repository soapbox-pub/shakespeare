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

      // System Settings Section
      systemSettings: 'System Settings',
      systemSettingsDescription: 'Configure system-level settings and advanced options.',
      esmUrl: 'Javascript CDN',
      esmUrlDescription: 'Javascript CDN URL for package imports.',
      projectTemplate: 'Project Template',
      projectTemplateDescription: 'Git repository URL to use as the starting template for new projects.',
      previewDomain: 'Preview Domain',
      previewDomainDescription: 'Domain used for iframe preview sandboxing.',
      corsProxy: 'CORS Proxy',
      corsProxyDescription: 'HTTP proxy URL for bypassing CORS restrictions.',
      deployServer: 'Deploy Server',
      deployServerDescription: 'Server domain where projects will be deployed.',

      // Language Options
      english: 'English',
      portuguese: 'Portuguese',
      chinese: 'Chinese',
      hausa: 'Hausa',
      yoruba: 'Yoruba',
      igbo: 'Igbo',
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
      buildNostrApps: 'Build apps with AI',
      whatToBuild: 'What would you like to build?',
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
      storageSettings: 'Storage',
      storageSettingsDescription: 'Export files and manage local data',
      emailUpdates: 'Email Updates',
      emailUpdatesDescription: 'Subscribe to Shakespeare updates and resources',

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
      askToAddFeatures: 'Ask me to add features, edit files, or build your project...',
      selectModelFirst: 'Please select a model to start chatting...',
      sendMessage: 'Send message',
      stopGeneration: 'Stop generation',
      running: 'Running',

      // Project View Navigation
      chat: 'Chat',
      preview: 'Preview',
      code: 'Code',
      backToPreview: 'Back to Preview',

      // Preview Pane
      projectPreview: 'Project Preview',
      buildProjectToSeePreview: 'Build your project to see the preview here',
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
      useCorsProxy: 'Use CORS Proxy',
      addCustomProviderButton: 'Add Custom Provider',
      providerExists: 'Provider with this name already exists',
      agreeToTermsOfService: 'I agree to {{providerName}}’s',
      termsOfService: 'Terms of Service',
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

      // About Settings
      aboutShakespeare: 'About Shakespeare',
      aboutShakespeareDescription: 'Information about Shakespeare',
      sourceCode: 'Source Code',
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
      persistData: 'Persist Data',
      persistDataDescription: 'Request persistent storage to prevent data loss when browser storage is low. This helps protect your projects and settings.',
      persistentStorageGranted: 'Persistent storage granted',
      persistentStorageGrantedDescription: 'Your browser will now protect your data from automatic cleanup.',
      persistentStorageAlreadyGranted: 'Persistent storage already granted',
      persistentStorageAlreadyGrantedDescription: 'Your data is already protected from automatic cleanup.',
      persistentStorageDenied: 'Persistent storage request denied',
      persistentStorageDeniedDescription: 'Your browser declined the request. Data may still be cleared automatically when storage is low.',
      persistentStorageNotSupported: 'Persistent storage not supported',
      persistentStorageNotSupportedDescription: 'Your browser does not support persistent storage requests.',
      failedToRequestPersistentStorage: 'Failed to request persistent storage',

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

      // API Authentication Errors
      apiAuthenticationFailed: 'API Authentication Failed',
      invalidApiKey: 'Invalid API key for {{provider}}. Please check your API key in Settings.',
      checkApiKeySettings: 'Check API Key Settings',

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

      // System Settings Section
      systemSettings: 'Configurações do Sistema',
      systemSettingsDescription: 'Configure configurações de nível de sistema e opções avançadas.',
      esmUrl: 'URL do CDN Javascript',
      esmUrlDescription: 'URL do CDN Javascript para importações de pacotes.',

      // Language Options
      english: 'Inglês',
      portuguese: 'Português',
      chinese: 'Chinês',
      hausa: 'Hausa',
      yoruba: 'Yoruba',
      igbo: 'Igbo',
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
      buildNostrApps: 'Construa aplicativos com IA',
      whatToBuild: 'O que você gostaria de construir?',
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
      storageSettings: 'Armazenamento',
      storageSettingsDescription: 'Exporte arquivos e gerencie dados locais',
      emailUpdates: 'Atualizações por Email',
      emailUpdatesDescription: 'Inscreva-se para receber atualizações e recursos do Shakespeare',

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
      askToAddFeatures: 'Peça para adicionar recursos, editar arquivos ou construir seu projeto...',
      selectModelFirst: 'Selecione um modelo para começar a conversar...',
      sendMessage: 'Enviar mensagem',
      stopGeneration: 'Parar geração',
      running: 'Executando',

      // Project View Navigation
      chat: 'Chat',
      preview: 'Visualização',
      code: 'Código',
      backToPreview: 'Voltar à Visualização',

      // Preview Pane
      projectPreview: 'Visualização do Projeto',
      buildProjectToSeePreview: 'Construa seu projeto para ver a visualização aqui',
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
      useCorsProxy: 'Usar Proxy CORS',
      addCustomProviderButton: 'Adicionar Provedor Personalizado',
      providerExists: 'Provedor com este nome já existe',
      agreeToTermsOfService: 'Concordo com {{providerName}}',
      termsOfService: 'Termos de Serviço',
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
      projectTemplate: 'Modelo de Projeto',
      projectTemplateDescription: 'URL do repositório Git a ser usado como modelo inicial para novos projetos.',
      corsProxy: 'Proxy CORS',
      corsProxyDescription: 'Proxy usado para contornar CORS para operações de IA e Git.',
      deployServer: 'Servidor de Deploy',
      deployServerDescription: 'Domínio do servidor onde os projetos serão implantados.',

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
      persistData: 'Persistir Dados',
      persistDataDescription: 'Solicitar armazenamento persistente para evitar perda de dados quando o armazenamento do navegador estiver baixo. Isso ajuda a proteger seus projetos e configurações.',
      persistentStorageGranted: 'Armazenamento persistente concedido',
      persistentStorageGrantedDescription: 'Seu navegador agora protegerá seus dados da limpeza automática.',
      persistentStorageAlreadyGranted: 'Armazenamento persistente já concedido',
      persistentStorageAlreadyGrantedDescription: 'Seus dados já estão protegidos da limpeza automática.',
      persistentStorageDenied: 'Solicitação de armazenamento persistente negada',
      persistentStorageDeniedDescription: 'Seu navegador recusou a solicitação. Os dados ainda podem ser limpos automaticamente quando o armazenamento estiver baixo.',
      persistentStorageNotSupported: 'Armazenamento persistente não suportado',
      persistentStorageNotSupportedDescription: 'Seu navegador não suporta solicitações de armazenamento persistente.',
      failedToRequestPersistentStorage: 'Falha ao solicitar armazenamento persistente',

      // About Settings
      aboutShakespeare: 'Sobre o Shakespeare',
      aboutShakespeareDescription: 'Informações sobre o Shakespeare.',
      sourceCode: 'Código-fonte',
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

      // API Authentication Errors
      apiAuthenticationFailed: 'Falha na Autenticação da API',
      invalidApiKey: 'Chave de API inválida para {{provider}}. Verifique sua chave de API nas Configurações.',
      checkApiKeySettings: 'Verificar Configurações da Chave de API',

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

      // System Settings Section
      systemSettings: '系统设置',
      systemSettingsDescription: '配置系统级设置和高级选项。',
      esmUrl: 'Javascript CDN URL',
      esmUrlDescription: '包导入的 Javascript CDN URL。',

      // Language Options
      english: 'English',
      portuguese: 'Português',
      chinese: '中文',
      hausa: 'Hausa',
      yoruba: 'Yoruba',
      igbo: 'Igbo',
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
      buildNostrApps: '使用AI构建应用',
      whatToBuild: '您想构建什么？',
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
      storageSettings: '存储',
      storageSettingsDescription: '导出文件和管理本地数据',
      emailUpdates: '邮件更新',
      emailUpdatesDescription: '订阅Shakespeare更新和资源',

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
      askToAddFeatures: '请我添加功能、编辑文件或构建您的项目...',
      selectModelFirst: '请先选择一个模型开始聊天...',
      sendMessage: '发送消息',
      stopGeneration: '停止生成',
      running: '运行中',

      // Project View Navigation
      chat: '聊天',
      preview: '预览',
      code: '代码',
      backToPreview: '返回预览',

      // Preview Pane
      projectPreview: '项目预览',
      buildProjectToSeePreview: '构建您的项目以在此处查看预览',
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
      useCorsProxy: '使用CORS代理',
      addCustomProviderButton: '添加自定义提供商',
      providerExists: '此名称的提供商已存在',
      agreeToTermsOfService: '我同意{{providerName}}',
      termsOfService: '服务条款',
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
      projectTemplate: '项目模板',
      projectTemplateDescription: '用作新项目起始模板的Git仓库URL。',
      corsProxy: 'CORS代理',
      corsProxyDescription: '用于绕过CORS的代理,适用于AI和Git操作。',
      deployServer: '部署服务器',
      deployServerDescription: '项目将部署到的服务器域名。',

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
      persistData: '持久化数据',
      persistDataDescription: '请求持久存储以防止浏览器存储不足时数据丢失。这有助于保护您的项目和设置。',
      persistentStorageGranted: '已授予持久存储',
      persistentStorageGrantedDescription: '您的浏览器现在将保护您的数据免受自动清理。',
      persistentStorageAlreadyGranted: '已授予持久存储',
      persistentStorageAlreadyGrantedDescription: '您的数据已受到保护，不会被自动清理。',
      persistentStorageDenied: '持久存储请求被拒绝',
      persistentStorageDeniedDescription: '您的浏览器拒绝了请求。当存储不足时，数据仍可能被自动清理。',
      persistentStorageNotSupported: '不支持持久存储',
      persistentStorageNotSupportedDescription: '您的浏览器不支持持久存储请求。',
      failedToRequestPersistentStorage: '请求持久存储失败',

      // About Settings
      aboutShakespeare: '关于Shakespeare',
      aboutShakespeareDescription: '关于Shakespeare的信息。',
      sourceCode: '源代码',
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

      // API Authentication Errors
      apiAuthenticationFailed: 'API身份验证失败',
      invalidApiKey: '{{provider}}的API密钥无效。请在设置中检查您的API密钥。',
      checkApiKeySettings: '检查API密钥设置',

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
  },
  ha: {
    translation: {
      // Navigation and Layout
      preferences: 'Zaɓuɓɓuka',
      settings: 'Saitunan',
      backToSettings: 'Koma zuwa Saitunan',
      help: 'Taimako',
      anonymous: 'Maras Suna',

      // Authentication
      logIn: 'Shiga',
      signUp: 'Yi Rajista',

      // Preferences Page
      preferencesDescription: 'Sarrafa zaɓuɓɓukan aikace-aikacenku da saitunan bayyanar.',

      // Theme Section
      theme: 'Jigogi',
      themeDescription: 'Zaɓi tsakanin haske, duhu, ko zaɓin jigogi na tsarin.',

      // Language Section
      language: 'Harshe',
      languageDescription: 'Zaɓi harshen da kuke so don dubawa.',

      // System Settings Section
      systemSettings: 'Saitunan Tsarin',
      systemSettingsDescription: 'Saita saitunan matakin tsari da zaɓuɓɓuka na ci gaba.',
      esmUrl: 'URL na CDN Javascript',
      esmUrlDescription: 'URL na CDN Javascript don shigo da fakitin.',

      // Language Options
      english: 'Turanci',
      portuguese: 'Fotigis',
      chinese: 'Sinanci',
      hausa: 'Hausa',
      yoruba: 'Yoruba',
      igbo: 'Igbo',
      systemLanguage: 'Tsarin',

      // Theme Options
      light: 'Haske',
      dark: 'Duhu',
      system: 'Tsarin',

      // Common UI Elements
      save: 'Ajiye',
      cancel: 'Soke',
      close: 'Rufe',
      open: 'Buɗe',
      edit: 'Gyara',
      delete: 'Share',
      create: 'Ƙirƙira',
      update: 'Sabunta',
      loading: 'Ana lodin...',
      error: 'Kuskure',
      success: 'Nasara',
      warning: 'Gargaɗi',
      info: 'Bayani',
      add: 'Ƙara',
      remove: 'Cire',
      retry: 'Sake gwadawa',

      // Shakespeare Main Page
      buildNostrApps: 'Gina aikace-aikace da AI',
      whatToBuild: 'Me kuke son ginawa?',
      chooseModel: 'Zaɓi samfuri...',
      selectModelToDescribe: "Da fatan za a zaɓi samfuri a ƙasa, sannan a bayyana abin da kuke son ginawa...",
      examplePrompt: "misali, Ƙirƙiri kasuwar kayan aikin noma don manoma na yankin su sayi da sayar da taraktoci, kayan aiki, da kayayyaki...",

      // Settings Page
      settingsDescription: 'Sarrafa saitunan aikace-aikacenku da zaɓuɓɓuka.',
      aiSettings: 'Saitunan AI',
      aiSettingsDescription: 'Saita masu samar da AI da maɓallan API',
      gitSettings: 'Saitunan Git',
      gitSettingsDescription: 'Saita bayanan shaidar Git don tabbatar da HTTP',
      nostrSettings: 'Saitunan Nostr',
      nostrSettingsDescription: 'Saita haɗin relay da zaɓuɓɓukan Nostr',
      storageSettings: 'Ajiya',
      storageSettingsDescription: 'Fitar da fayiloli da sarrafa bayanan gida',
      emailUpdates: 'Sabuntawar Imel',
      emailUpdatesDescription: 'Yi rajista don karbar sabuntawar Shakespeare da albarkatu',

      // Project Sidebar
      newProject: 'Sabon Aikin',
      importRepository: 'Shigo da Repository',
      noProjectsYet: 'Babu ayyuka har yanzu',
      createFirstProject: 'Ƙirƙiri aikin farko don farawa',
      closeSidebar: 'Rufe gefen mashigi',
      collapseSidebar: 'Rufe gefen mashigi',

      // Chat Interface
      welcomeToShakespeare: 'Maraba da Shakespeare',
      aiAssistantReady: 'Mataimakin ci gaban ku na AI ya shirya don taimaka muku gina, gyara, da haɓaka aikinku.',
      askMeFeatures: '💡 Roƙe ni in ƙara sabbin fasaloli',
      requestEdits: '📝 Nemi gyare-gyaren fayil da haɓakawa',
      getHelp: '🔧 Sami taimako da gyara kuskure da haɓakawa',
      buildDeploy: '🚀 Gina da tura aikinku',
      aiNotConfigured: 'Mataimakin AI Ba a Saita ba',
      askToAddFeatures: 'Roƙe ni in ƙara fasaloli, gyara fayiloli, ko gina aikinku...',
      selectModelFirst: 'Da fatan za a zaɓi samfuri don farawa hira...',
      sendMessage: 'Aika saƙo',
      stopGeneration: 'Tsayar da samarwa',
      running: 'Ana gudana',

      // Project View Navigation
      chat: 'Hira',
      preview: 'Duba',
      code: 'Lambar',
      backToPreview: 'Koma zuwa Duba',

      // Preview Pane
      projectPreview: 'Duban Aikin',
      buildProjectToSeePreview: 'Gina aikinku don ganin duba a nan',
      fileEditor: 'Editan Fayil',
      selectFileFromExplorer: 'Zaɓi fayil daga mai bincike don gyarawa',
      openFileExplorer: 'Buɗe Mai Binciken Fayil',

      // File Editor
      unsavedChanges: 'Canje-canjen da ba a ajiye ba',
      saving: 'Ana ajiyewa...',
      languageLabel: 'Harshe',

      // File Tree
      searchFiles: 'Neman fayiloli...',
      noFilesFound: 'Babu fayilolin da aka samu',
      noFilesFoundSearch: 'Babu fayilolin da suka dace da bincikenku',

      // Git Dialog
      gitRepositoryStatus: 'Matsayin Repository na Git',
      repositoryStatusDescription: 'Duba matsayin repository da haɗawa da repositories na nesa',
      repositoryInformation: 'Bayanan Repository',
      currentBranch: 'Reshen Yanzu',
      totalCommits: 'Jimlar Commits',
      latestCommit: 'Commit na Baya-bayan nan',
      remotes: 'Na Nesa',
      notGitRepository: 'Ba repository na Git ba',
      gitAuthentication: 'Tabbatarwa',
      credentialsDescription: 'Bayanan shaidar don ayyukan tura/ja',
      configured: 'An saita',
      noCredentials: 'Babu bayanan shaidar',
      noCredentialsWarning: 'Babu bayanan shaidar da aka saita don {{provider}}. Ayyukan tura/ja na iya gazawa don repositories masu sirri.',
      configureCredentials: 'Saita bayanan shaidar',
      syncStatus: 'Matsayin Haɗawa',
      pull: 'Ja',
      push: 'Tura',
      pulling: 'Ana ja...',
      pushing: 'Ana turawa...',
      upToDate: 'An sabunta',
      commitsAhead: 'Commit {{count}} a gaba | Commits {{count}} a gaba',
      commitsBehind: 'Commit {{count}} a baya | Commits {{count}} a baya',
      uncommittedChanges: 'Canji {{count}} da ba a commit ba | Canje-canje {{count}} da ba a commit ba',
      noRemoteConfigured: 'Babu na nesa da aka saita',
      workingDirectoryChanges: 'Canje-canjen Directory na Aiki',
      filesWithChanges: 'Fayil {{count}} da canje-canje | Fayiloli {{count}} da canje-canje',
      workingDirectoryClean: 'Directory na aiki tsabta ne',
      noUncommittedChanges: 'Babu canje-canjen da ba a commit ba',
      cannotPush: 'Ba za a iya turawa ba',
      cannotPull: 'Ba za a iya ja ba',
      notGitRepoOrBranch: 'Ba repository na git ba ko babu reshen yanzu',
      noRemoteRepositories: 'Babu repositories na nesa da aka saita',
      nothingToPush: 'Babu abin da za a tura',
      noCommitsAhead: 'Babu commits a gaban na nesa. Fara commit canje-canjenku.',
      pushSuccessful: 'Turawa ta yi nasara',
      pushFailed: 'Turawa ta gaza',
      pullSuccessful: 'Ja ya yi nasara',
      pullFailed: 'Ja ya gaza',

      // AI Settings
      aiSettingsDescriptionLong: 'Saita masu samar da AI ta hanyar ƙara maɓallan API. Saitunan ana ajiye su kai tsaye kuma ana adana su a cikin burauzar ku.',
      configuredProviders: 'Masu Samarwa da aka Saita',
      addProvider: 'Ƙara Mai Samarwa',
      getApiKey: 'Sami maɓallin API',
      getToken: 'Sami alamar',
      enterApiKey: 'Shigar da maɓallin API',
      enterToken: 'Shigar da alamar ku',
      enterCashuToken: 'Shigar da alamar Cashu',
      addCustomProvider: 'Ƙara Mai Samarwa na Musamman',
      providerName: 'Sunan Mai Samarwa',
      baseUrl: 'URL na Tushe',
      apiKey: 'Maɓallin API',
      authentication: 'Tabbatarwa',
      useCorsProxy: 'Yi amfani da CORS Proxy',
      addCustomProviderButton: 'Ƙara Mai Samarwa na Musamman',
      providerExists: 'Mai samarwa da wannan suna ya riga ya wanzu',
      agreeToTermsOfService: 'Na yarda da {{providerName}}',
      termsOfService: 'Sharuɗɗan Sabis',
      custom: 'Na Musamman',
      connecting: 'Ana haɗawa...',
      connectToGitHub: 'Haɗu da GitHub',
      loginToNostrRequired: 'Shiga Nostr don amfani da wannan mai samarwa',
      goToNostrSettings: 'Tafi zuwa Saitunan Nostr',

      // Git Settings
      gitSettingsDescriptionLong: 'Saita bayanan shaidar Git don tabbatar da HTTP. Saitunan ana ajiye su kai tsaye kuma ana adana su a cikin burauzar ku.',
      configuredCredentials: 'Bayanan Shaidar da aka Saita',
      origin: 'Asali',
      username: 'Sunan mai amfani',
      password: 'Kalmar sirri',
      enterPassword: 'Shigar da kalmar sirri/alamar ku',
      credentialsExist: 'Bayanan shaidar wannan asali sun riga sun wanzu',
      projectTemplate: 'Samfurin Aikin',
      projectTemplateDescription: 'URL ɗin ma\'ajin Git da za a yi amfani da shi azaman samfurin farawa don sababbin ayyuka.',
      corsProxy: 'CORS Proxy',
      corsProxyDescription: 'Proxy da ake amfani da shi don ketare CORS don ayyukan AI da Git.',
      deployServer: 'Sabar Turawa',
      deployServerDescription: 'Wurin sabar da za a tura ayyuka zuwa.',

      // Data Settings
      dataSettingsDescriptionLong: 'Fitar da fayiloli da sarrafa bayanan gida.',
      exportFiles: 'Fitar da Fayiloli',
      exportFilesDescription: 'Sauke duk ayyukanku da fayiloli azaman ajiyar ZIP. Wannan ya haɗa da duk fayilolin aikin, saitunan, da bayanan da aka adana a gida.',
      exportAllFiles: 'Fitar da Duk Fayiloli',
      exporting: 'Ana fitarwa...',
      clearAllData: 'Share Duk Bayanai',
      clearAllDataDescription: 'Share duk bayanan gida har abada ciki har da ayyuka, saitunan, da bayanan cache. Wannan aikin ba za a iya sokewa ba.',
      clearing: 'Ana sharewa...',
      areYouSure: 'Kun tabbata sosai?',
      clearDataWarning: 'Wannan aikin zai share duk bayanan gida daga wannan burauzar har abada, ciki har da:',
      allProjects: 'Duk ayyuka da fayilolinsu',
      aiSettingsAndKeys: 'Saitunan AI da maɓallan API',
      gitCredentialsSettings: 'Bayanan shaidar Git da saitunan',
      userPreferences: 'Zaɓuɓɓukan mai amfani da jigogi',
      cachedData: 'Bayanan cache da bayanan zama',
      actionCannotBeUndone: 'Wannan aikin ba za a iya sokewa ba. Yi la\'akari da fitar da fayilolinku da farko.',
      yesClearAllData: 'Eh, share duk bayanai',
      used: 'An yi amfani',
      available: 'Akwai',
      usagePercentage: 'An yi amfani da {{percentage}}%',
      usageUnavailable: 'Adadin amfani ba ya samuwa',
      loadingStorageInfo: 'Ana lodin bayanan ajiya...',
      filesExportedSuccessfully: 'An fitar da fayiloli cikin nasara',
      filesExportedDescription: 'An sauke fayilolin aikinku azaman fayil zip.',
      failedToExportFiles: 'Ya gaza fitar da fayiloli',
      dataClearedSuccessfully: 'An share bayanai cikin nasara',
      dataClearedDescription: 'An cire duk bayanan gida. Ana turawa zuwa shafin gida...',
      failedToClearData: 'Ya gaza share bayanai',
      persistData: 'Kiyaye Bayanai',
      persistDataDescription: 'Nemi ajiyar bayanai ta dindindin don hana asarar bayanai lokacin da ajiyar burauzar ta ragu. Wannan yana taimakawa wajen kare ayyukan ku da saitunan.',
      persistentStorageGranted: 'An ba da ajiyar ta dindindin',
      persistentStorageGrantedDescription: 'Burauzar ku yanzu za ta kare bayananku daga share mai sarrafa kansa.',
      persistentStorageAlreadyGranted: 'An riga an ba da ajiyar ta dindindin',
      persistentStorageAlreadyGrantedDescription: 'An riga an kare bayananku daga share mai sarrafa kansa.',
      persistentStorageDenied: 'An ki neman ajiyar ta dindindin',
      persistentStorageDeniedDescription: 'Burauzar ku ta ki bukatar. Ana iya share bayanai ta atomatik lokacin da ajiya ta ragu.',
      persistentStorageNotSupported: 'Ba a goyan bayan ajiyar ta dindindin ba',
      persistentStorageNotSupportedDescription: 'Burauzar ku ba ta goyan bayan bukatun ajiyar ta dindindin ba.',
      failedToRequestPersistentStorage: 'Ya gaza neman ajiyar ta dindindin',

      // About Settings
      aboutShakespeare: 'Game da Shakespeare',
      aboutShakespeareDescription: 'Bayani game da Shakespeare.',
      sourceCode: 'Lambar Tushe',
      description: 'Bayanin',
      license: 'Lasisi',
      loadingLicense: 'Ana lodin lasisi...',
      failedToLoadLicense: 'Ya gaza lodin lasisi',

      // 404 Page
      pageNotFound: 'Kai! Ba a sami shafin ba',
      returnToHome: 'Koma Gida',

      // Model Selector
      selectOrEnterModel: 'Zaɓi ko shigar da samfuri...',
      searchModels: 'Neman samfura...',
      enterCustomModel: 'Shigar da samfuri na musamman...',
      manageProviders: 'Sarrafa masu samarwa...',
      noModelsFound: 'Ba a sami samfura ba.',
      tryCustomModel: 'Gwada amfani da samfuri na musamman.',
      recentlyUsed: 'An yi amfani da su kwanan nan',
      errorLoadingModels: 'Kuskure wajen Lodin Samfura',

      // API Authentication Errors
      apiAuthenticationFailed: 'Gazawar Tabbatarwar API',
      invalidApiKey: 'Maɓallin API na {{provider}} ba daidai ba ne. Da fatan za a duba maɓallin API a cikin Saitunan.',
      checkApiKeySettings: 'Duba Saitunan Maɓallin API',

      // Context and Cost
      contextUsage: 'Amfanin mahallin: {{tokens}} / {{total}} alamomi ({{percentage}}%)',
      totalCostSession: 'Jimlar farashi don wannan zaman hira',

      // File Status
      added: 'an ƙara',
      deleted: 'an share',
      modified: 'an gyara',
      staged: 'an shirya',
      untracked: 'ba a bi ba',

      // Settings Layout
      toggleSidebar: 'Juya gefen mashigi',
      openSidebar: 'Buɗe gefen mashigi',

      // Nostr Settings
      nostrSettingsDescriptionLong: 'Saita saitunan haɗin Nostr da zaɓuɓɓukan relay.',
      nostrAccounts: 'Asusun Nostr',
      noAccountsLoggedIn: 'Babu asusun da aka shiga. Ƙara asusu don farawa.',
      createAccount: 'Ƙirƙiri Asusu',
      addExistingAccount: 'Ƙara Asusu da ya wanzu',
      addAccount: 'Ƙara Asusu',
      relayConfiguration: 'Saitunan Relay',
      selectedRelay: 'Relay da aka zaɓa',

      // Clone Page
      cloneGitRepository: 'Clone repository na Git zuwa wurin aikin Shakespeare',
      pleaseEnterRepositoryUrl: 'Da fatan za a shigar da URL na repository',
      pleaseEnterValidGitUrl: 'Da fatan za a shigar da ingantaccen URL na repository na Git ko URI na clone na Nostr (misali: nostr://npub.../sunan-repo)',
      cloningRepository: 'Ana Clone Repository...',
      nostrRepositoryImportedSuccessfully: 'An shigo da repository na Nostr cikin nasara',
      repositoryClonedFromNostr: 'An clone "{{repoName}}" daga Nostr kuma ya shirya don ci gaba.',
      repositoryImportedSuccessfully: 'An shigo da repository cikin nasara',
      repositoryClonedReady: 'An clone "{{repoName}}" kuma ya shirya don ci gaba.',
      failedToImportRepository: 'Ya gaza shigo da repository',
      repositoryNotFoundOnNostr: 'Ba a sami repository akan hanyar sadarwar Nostr ba. Da fatan za a duba URI kuma a sake gwadawa.',
      noCloneUrlsFound: 'An sami sanarwar repository amma babu URLs na clone da ke samuwa.',
      allCloneAttemptsFailed: 'An sami repository amma duk URLs na clone sun gaza. Repository na iya zama ba ya samuwa.',
      repositoryNotFound: 'Ba a sami repository ba. Da fatan za a duba URL kuma a sake gwadawa.',
      accessDenied: 'An hana shiga. Repository na iya zama na sirri ko yana buƙatar tabbatarwa.',
      networkError: 'Kuskuren hanyar sadarwa. Da fatan za a duba haɗinku kuma a sake gwadawa.',
    }
  },
  yo: {
    translation: {
      // Navigation and Layout
      preferences: 'Awọn ayanfẹ',
      settings: 'Awọn eto',
      backToSettings: 'Pada si Awọn eto',
      help: 'Iranlọwọ',
      anonymous: 'Alainidamọ',

      // Authentication
      logIn: 'Wọle',
      signUp: 'Forukọsilẹ',

      // Preferences Page
      preferencesDescription: 'Ṣakoso awọn ayanfẹ ohun elo rẹ ati awọn eto iwoye.',

      // Theme Section
      theme: 'Akori',
      themeDescription: 'Yan laarin imọlẹ, okunkun, tabi ayanfẹ akori eto.',

      // Language Section
      language: 'Ede',
      languageDescription: 'Yan ede ti o fẹran fun wiwo.',

      // System Settings Section
      systemSettings: 'Saitunan Eto',
      systemSettingsDescription: 'Tunto awọn saitan eto ati awọn ayanfẹ ti o pọju.',
      esmUrl: 'URL CDN Javascript',
      esmUrlDescription: 'URL CDN Javascript fun gbigbe awọn package.',

      // Language Options
      english: 'Gẹẹsi',
      portuguese: 'Potogisi',
      chinese: 'Kannada',
      hausa: 'Hausa',
      yoruba: 'Yoruba',
      igbo: 'Igbo',
      systemLanguage: 'Eto',

      // Theme Options
      light: 'Imọlẹ',
      dark: 'Okunkun',
      system: 'Eto',

      // Common UI Elements
      save: 'Fi pamọ',
      cancel: 'Fagilee',
      close: 'Ti',
      open: 'Ṣi',
      edit: 'Ṣatunkọ',
      delete: 'Paarẹ',
      create: 'Ṣẹda',
      update: 'Imudojuiwọn',
      loading: 'N gbe...',
      error: 'Aṣiṣe',
      success: 'Aṣeyọri',
      warning: 'Ikilọ',
      info: 'Alaye',
      add: 'Fi kun',
      remove: 'Yọ kuro',
      retry: 'Tun gbiyanju',

      // Shakespeare Main Page
      buildNostrApps: 'Kọ awọn ohun elo pẹlu AI',
      whatToBuild: 'Kini o fẹ kọ?',
      chooseModel: 'Yan awoṣe...',
      selectModelToDescribe: "Jọwọ yan awoṣe ni isalẹ, lẹhinna ṣapejuwe ohun ti o fẹ kọ...",
      examplePrompt: "apeere, Ṣẹda ọja ẹrọ ogbin fun awọn agbe agbegbe lati ra ati ta awọn traktọ, awọn irinṣẹ, ati awọn ipese...",

      // Settings Page
      settingsDescription: 'Ṣakoso awọn eto ohun elo rẹ ati awọn ayanfẹ.',
      aiSettings: 'Awọn eto AI',
      aiSettingsDescription: 'Tunto awọn olupese AI ati awọn bọtini API',
      gitSettings: 'Awọn eto Git',
      gitSettingsDescription: 'Tunto awọn ẹri Git fun ijẹrisi HTTP',
      nostrSettings: 'Awọn eto Nostr',
      nostrSettingsDescription: 'Tunto awọn asopọ relay ati awọn ayanfẹ Nostr',
      storageSettings: 'Ibi ipamọ',
      storageSettingsDescription: 'Gbe awọn faili jade ati ṣakoso data agbegbe',
      emailUpdates: 'Awọn Imudojuiwọn Imeeli',
      emailUpdatesDescription: 'Forukọsilẹ fun awọn imudojuiwọn Shakespeare ati awọn ohun elo',

      // Project Sidebar
      newProject: 'Iṣẹ akanṣe Tuntun',
      importRepository: 'Gbe Repository wọle',
      noProjectsYet: 'Ko si awọn iṣẹ akanṣe sibẹsibẹ',
      createFirstProject: 'Ṣẹda iṣẹ akanṣe akọkọ rẹ lati bẹrẹ',
      closeSidebar: 'Ti ẹgbẹ sidebar',
      collapseSidebar: 'Subu sidebar',

      // Chat Interface
      welcomeToShakespeare: 'Kaabo si Shakespeare',
      aiAssistantReady: 'Oluranlọwọ idagbasoke AI rẹ ti ṣetan lati ran ọ lọwọ lati kọ, ṣatunkọ, ati mu iṣẹ akanṣe rẹ dara si.',
      askMeFeatures: '💡 Beere mi lati fi awọn ẹya tuntun kun',
      requestEdits: '📝 Beere awọn atunkọ faili ati awọn ilọsiwaju',
      getHelp: '🔧 Gba iranlọwọ pẹlu atunṣe ati imudara',
      buildDeploy: '🚀 Kọ ati gbe iṣẹ akanṣe rẹ lọ',
      aiNotConfigured: 'Oluranlọwọ AI Ko Tunto',
      askToAddFeatures: 'Beere mi lati fi awọn ẹya kun, ṣatunkọ awọn faili, tabi kọ iṣẹ akanṣe rẹ...',
      selectModelFirst: 'Jọwọ yan awoṣe lati bẹrẹ ibaraẹnisọrọ...',
      sendMessage: 'Fi ifiranṣẹ ranṣẹ',
      stopGeneration: 'Duro ṣiṣẹda',
      running: 'N ṣiṣẹ',

      // Project View Navigation
      chat: 'Ibaraẹnisọrọ',
      preview: 'Aṣaju wiwo',
      code: 'Koodu',
      backToPreview: 'Pada si Aṣaju wiwo',

      // Preview Pane
      projectPreview: 'Aṣaju wiwo Iṣẹ akanṣe',
      buildProjectToSeePreview: 'Kọ iṣẹ akanṣe rẹ lati ri aṣaju wiwo nibi',
      fileEditor: 'Atunkọ Faili',
      selectFileFromExplorer: 'Yan faili lati oluṣawari lati ṣatunkọ',
      openFileExplorer: 'Ṣi Oluṣawari Faili',

      // File Editor
      unsavedChanges: 'Awọn iyipada ti a ko fi pamọ',
      saving: 'N fi pamọ...',
      languageLabel: 'Ede',

      // File Tree
      searchFiles: 'Wa awọn faili...',
      noFilesFound: 'Ko si awọn faili ti a ri',
      noFilesFoundSearch: 'Ko si awọn faili ti o baamu wiwa rẹ',

      // Git Dialog
      gitRepositoryStatus: 'Ipo Repository Git',
      repositoryStatusDescription: 'Wo ipo repository ati muṣọpọ pẹlu awọn repository latọna jijin',
      repositoryInformation: 'Alaye Repository',
      currentBranch: 'Ẹka lọwọlọwọ',
      totalCommits: 'Lapapọ Awọn commit',
      latestCommit: 'Commit tuntun julọ',
      remotes: 'Awọn latọna jijin',
      notGitRepository: 'Kii ṣe repository Git',
      gitAuthentication: 'Ijẹrisi',
      credentialsDescription: 'Awọn ẹri fun awọn iṣẹ titari/fa',
      configured: 'Ti tunto',
      noCredentials: 'Ko si awọn ẹri',
      noCredentialsWarning: 'Ko si awọn ẹri ti a tunto fun {{provider}}. Awọn iṣẹ titari/fa le kuna fun awọn repository ikọkọ.',
      configureCredentials: 'Tunto awọn ẹri',
      syncStatus: 'Ipo Muṣọpọ',
      pull: 'Fa',
      push: 'Titari',
      pulling: 'N fa...',
      pushing: 'N titari...',
      upToDate: 'Ti imudojuiwọn',
      commitsAhead: 'Commit {{count}} ni iwaju | Awọn commit {{count}} ni iwaju',
      commitsBehind: 'Commit {{count}} ni ẹhin | Awọn commit {{count}} ni ẹhin',
      uncommittedChanges: 'Iyipada {{count}} ti a ko commit | Awọn iyipada {{count}} ti a ko commit',
      noRemoteConfigured: 'Ko si latọna jijin ti a tunto',
      workingDirectoryChanges: 'Awọn iyipada Itọsọna Iṣẹ',
      filesWithChanges: 'Faili {{count}} pẹlu awọn iyipada | Awọn faili {{count}} pẹlu awọn iyipada',
      workingDirectoryClean: 'Itọsọna iṣẹ mọ',
      noUncommittedChanges: 'Ko si awọn iyipada ti a ko commit',
      cannotPush: 'Ko le titari',
      cannotPull: 'Ko le fa',
      notGitRepoOrBranch: 'Kii ṣe repository git tabi ko si ẹka lọwọlọwọ',
      noRemoteRepositories: 'Ko si awọn repository latọna jijin ti a tunto',
      nothingToPush: 'Ko si nkankan lati titari',
      noCommitsAhead: 'Ko si awọn commit ni iwaju latọna jijin. Kọkọ commit awọn iyipada rẹ.',
      pushSuccessful: 'Titari ni aṣeyọri',
      pushFailed: 'Titari kuna',
      pullSuccessful: 'Fifa ni aṣeyọri',
      pullFailed: 'Fifa kuna',

      // AI Settings
      aiSettingsDescriptionLong: 'Tunto awọn olupese AI nipa fifi awọn bọtini API rẹ kun. Awọn eto ni a fi pamọ laifọwọyi ati pe a tọju wọn ni agbegbe ninu awọn aṣawakiri rẹ.',
      configuredProviders: 'Awọn Olupese Ti a Tunto',
      addProvider: 'Fi Olupese kun',
      getApiKey: 'Gba bọtini API',
      getToken: 'Gba token',
      enterApiKey: 'Tẹ bọtini API rẹ sinu',
      enterToken: 'Tẹ token rẹ sinu',
      enterCashuToken: 'Tẹ token Cashu sinu',
      addCustomProvider: 'Fi Olupese Aṣa kun',
      providerName: 'Orukọ Olupese',
      baseUrl: 'URL Ipilẹ',
      apiKey: 'Bọtini API',
      authentication: 'Ijẹrisi',
      useCorsProxy: 'Lo CORS Proxy',
      addCustomProviderButton: 'Fi Olupese Aṣa kun',
      providerExists: 'Olupese pẹlu orukọ yii ti wa tẹlẹ',
      agreeToTermsOfService: 'Mo gba {{providerName}}',
      termsOfService: 'Awọn Ofin Iṣẹ',
      custom: 'Aṣa',
      connecting: 'N so...',
      connectToGitHub: 'So si GitHub',
      loginToNostrRequired: 'Wọle si Nostr lati lo olupese yii',
      goToNostrSettings: 'Lọ si Awọn eto Nostr',

      // Git Settings
      gitSettingsDescriptionLong: 'Tunto awọn ẹri Git fun ijẹrisi HTTP. Awọn eto ni a fi pamọ laifọwọyi ati pe a tọju wọn ni agbegbe ninu awọn aṣawakiri rẹ.',
      configuredCredentials: 'Awọn Ẹri Ti a Tunto',
      origin: 'Ipilẹṣẹ',
      username: 'Orukọ olumulo',
      password: 'Ọrọ igbaniwọle',
      enterPassword: 'Tẹ ọrọ igbaniwọle/token rẹ sinu',
      credentialsExist: 'Awọn ẹri fun ipilẹṣẹ yii ti wa tẹlẹ',
      projectTemplate: 'Awoṣe Iṣẹ akanṣe',
      projectTemplateDescription: 'URL ibi ipamọ Git lati lo bi awoṣe ibẹrẹ fun awọn iṣẹ akanṣe tuntun.',
      corsProxy: 'CORS Proxy',
      corsProxyDescription: 'Olupin proxy ti a lo lati kọja CORS fun awọn iṣẹ AI ati Git.',
      deployServer: 'Olupin Ifilọlẹ',
      deployServerDescription: 'Aaye olupin nibiti a o fi awọn iṣẹ akanṣe ranṣẹ si.',

      // Data Settings
      dataSettingsDescriptionLong: 'Gbe awọn faili jade ati ṣakoso data agbegbe.',
      exportFiles: 'Gbe Awọn faili jade',
      exportFilesDescription: 'Gba gbogbo awọn iṣẹ akanṣe ati awọn faili rẹ gẹgẹbi apo ZIP. Eyi pẹlu gbogbo awọn faili iṣẹ akanṣe, awọn eto, ati data ti a tọju ni agbegbe.',
      exportAllFiles: 'Gbe Gbogbo Awọn faili jade',
      exporting: 'N gbe jade...',
      clearAllData: 'Nu Gbogbo Data',
      clearAllDataDescription: 'Pa gbogbo data agbegbe rẹ lailai pẹlu awọn iṣẹ akanṣe, awọn eto, ati alaye cache. Iṣẹ yii ko le ṣe atunṣe.',
      clearing: 'N nu...',
      areYouSure: 'Ṣe o daju pupọ?',
      clearDataWarning: 'Iṣẹ yii yoo pa gbogbo data agbegbe lati aṣawakiri yii lailai, pẹlu:',
      allProjects: 'Gbogbo awọn iṣẹ akanṣe ati awọn faili wọn',
      aiSettingsAndKeys: 'Awọn eto AI ati awọn bọtini API',
      gitCredentialsSettings: 'Awọn ẹri Git ati awọn eto',
      userPreferences: 'Awọn ayanfẹ olumulo ati awọn akori',
      cachedData: 'Data cache ati alaye igba',
      actionCannotBeUndone: 'Iṣẹ yii ko le ṣe atunṣe. Ronu lati gbe awọn faili rẹ jade ni akọkọ.',
      yesClearAllData: 'Bẹẹni, nu gbogbo data',
      used: 'Ti lo',
      available: 'Wa',
      usagePercentage: '{{percentage}}% ti lo',
      usageUnavailable: 'Ipin lilo ko wa',
      loadingStorageInfo: 'N gbe alaye ibi ipamọ...',
      filesExportedSuccessfully: 'Awọn faili ti gbe jade ni aṣeyọri',
      filesExportedDescription: 'Awọn faili iṣẹ akanṣe rẹ ti gba gẹgẹbi faili zip.',
      failedToExportFiles: 'O kuna lati gbe awọn faili jade',
      dataClearedSuccessfully: 'Data ti nu ni aṣeyọri',
      dataClearedDescription: 'Gbogbo data agbegbe ti yọ kuro. N ṣe atunṣe si oju-iwe ile...',
      failedToClearData: 'O kuna lati nu data',
      persistData: 'Fi Data Pamọ',
      persistDataDescription: 'Beere ibi ipamọ ti o wa nigbagbogbo lati yago fun isonu data nigbati ibi ipamọ aṣawakiri ba kere. Eyi ṣe iranlọwọ lati daabobo awọn iṣẹ akanṣe ati awọn eto rẹ.',
      persistentStorageGranted: 'Ibi ipamọ ti o wa nigbagbogbo ti funni',
      persistentStorageGrantedDescription: 'Aṣawakiri rẹ yoo daabobo data rẹ lati imukuro adaṣe.',
      persistentStorageAlreadyGranted: 'Ibi ipamọ ti o wa nigbagbogbo ti funni tẹlẹ',
      persistentStorageAlreadyGrantedDescription: 'Data rẹ ti wa ni aabo lati imukuro adaṣe.',
      persistentStorageDenied: 'Ibeere ibi ipamọ ti o wa nigbagbogbo ti kọ',
      persistentStorageDeniedDescription: 'Aṣawakiri rẹ ti kọ ibeere naa. Data le tun jẹ imukuro adaṣe nigbati ibi ipamọ ba kere.',
      persistentStorageNotSupported: 'Ibi ipamọ ti o wa nigbagbogbo ko ni atilẹyin',
      persistentStorageNotSupportedDescription: 'Aṣawakiri rẹ ko ni atilẹyin awọn ibeere ibi ipamọ ti o wa nigbagbogbo.',
      failedToRequestPersistentStorage: 'O kuna lati beere ibi ipamọ ti o wa nigbagbogbo',

      // About Settings
      aboutShakespeare: 'Nipa Shakespeare',
      aboutShakespeareDescription: 'Alaye nipa Shakespeare.',
      sourceCode: 'Koodu Orisun',
      description: 'Apejuwe',
      license: 'Iwe-aṣẹ',
      loadingLicense: 'N gbe iwe-aṣẹ...',
      failedToLoadLicense: 'O kuna lati gbe iwe-aṣẹ',

      // 404 Page
      pageNotFound: 'Yee! Oju-iwe ko ri',
      returnToHome: 'Pada si Ile',

      // Model Selector
      selectOrEnterModel: 'Yan tabi tẹ awoṣe sinu...',
      searchModels: 'Wa awọn awoṣe...',
      enterCustomModel: 'Tẹ awoṣe aṣa sinu...',
      manageProviders: 'Ṣakoso awọn olupese...',
      noModelsFound: 'Ko si awọn awoṣe ti a ri.',
      tryCustomModel: 'Gbiyanju lilo awoṣe aṣa dipo.',
      recentlyUsed: 'Ti a Lo Laipẹ',
      errorLoadingModels: 'Aṣiṣe Gbigbe Awọn awoṣe',

      // Context and Cost
      contextUsage: 'Lilo aaye oro: {{tokens}} / {{total}} awọn token ({{percentage}}%)',
      totalCostSession: 'Lapapọ iye owo fun igba ibaraẹnisọrọ yii',

      // File Status
      added: 'ti fi kun',
      deleted: 'ti paarẹ',
      modified: 'ti ṣatunkọ',
      staged: 'ti ṣetan',
      untracked: 'ti a ko tọpa',

      // Settings Layout
      toggleSidebar: 'Yipada sidebar',
      openSidebar: 'Ṣi sidebar',

      // Nostr Settings
      nostrSettingsDescriptionLong: 'Tunto awọn eto asopọ Nostr rẹ ati awọn ayanfẹ relay.',
      nostrAccounts: 'Awọn Akọọlẹ Nostr',
      noAccountsLoggedIn: 'Ko si awọn akọọlẹ ti o wọle. Fi akọọlẹ kun lati bẹrẹ.',
      createAccount: 'Ṣẹda Akọọlẹ',
      addExistingAccount: 'Fi Akọọlẹ Ti o Wa Tẹlẹ kun',
      addAccount: 'Fi Akọọlẹ kun',
      relayConfiguration: 'Iṣeto Relay',
      selectedRelay: 'Relay Ti a Yan',

      // Clone Page
      cloneGitRepository: 'Clone repository Git si aaye iṣẹ Shakespeare rẹ',
      pleaseEnterRepositoryUrl: 'Jọwọ tẹ URL repository sinu',
      pleaseEnterValidGitUrl: 'Jọwọ tẹ URL repository Git to tọ tabi URI clone Nostr sinu (apeere: nostr://npub.../orukọ-repo)',
      cloningRepository: 'N Clone Repository...',
      nostrRepositoryImportedSuccessfully: 'Repository Nostr ti gbe wọle ni aṣeyọri',
      repositoryClonedFromNostr: '"{{repoName}}" ti clone lati Nostr ati pe o ti ṣetan fun idagbasoke.',
      repositoryImportedSuccessfully: 'Repository ti gbe wọle ni aṣeyọri',
      repositoryClonedReady: '"{{repoName}}" ti clone ati pe o ti ṣetan fun idagbasoke.',
      failedToImportRepository: 'O kuna lati gbe repository wọle',
      repositoryNotFoundOnNostr: 'Repository ko ri lori nẹtiwọọki Nostr. Jọwọ ṣayẹwo URI ati gbiyanju lẹẹkansi.',
      noCloneUrlsFound: 'Ikede repository ri ṣugbọn ko si awọn URL clone to wa.',
      allCloneAttemptsFailed: 'Repository ri ṣugbọn gbogbo awọn URL clone kuna. Repository le ma wa.',
      repositoryNotFound: 'Repository ko ri. Jọwọ ṣayẹwo URL ati gbiyanju lẹẹkansi.',
      accessDenied: 'Wiwọle ni idinamọ. Repository le jẹ ikọkọ tabi nilo ijẹrisi.',
      networkError: 'Aṣiṣe nẹtiwọọki. Jọwọ ṣayẹwo asopọ rẹ ati gbiyanju lẹẹkansi.',
    }
  },
  ig: {
    translation: {
      // Navigation and Layout
      preferences: 'Nhọrọ',
      settings: 'Ntọala',
      backToSettings: 'Laghachi na Ntọala',
      help: 'Enyemaka',
      anonymous: 'Onye na-amaghị aha',

      // Authentication
      logIn: 'Banye',
      signUp: 'Debanye aha',

      // Preferences Page
      preferencesDescription: 'Jikwaa nhọrọ ngwa gị na ntọala ngosipụta.',

      // Theme Section
      theme: 'Isiokwu',
      themeDescription: 'Họrọ n\'etiti ìhè, ọchịchịrị, ma ọ bụ nhọrọ isiokwu sistemu.',

      // Language Section
      language: 'Asụsụ',
      languageDescription: 'Họrọ asụsụ ị chọrọ maka interface.',

      // System Settings Section
      systemSettings: 'Ntọala Sistemu',
      systemSettingsDescription: 'Hazie ntọala ọkwa sistemu na nhọrọ ndị ọganihu.',
      esmUrl: 'URL CDN Javascript',
      esmUrlDescription: 'URL CDN Javascript maka mbubata ngwugwu.',

      // Language Options
      english: 'Bekee',
      portuguese: 'Portuguese',
      chinese: 'Chinese',
      hausa: 'Hausa',
      yoruba: 'Yoruba',
      igbo: 'Igbo',
      systemLanguage: 'Sistemu',

      // Theme Options
      light: 'Ìhè',
      dark: 'Ọchịchịrị',
      system: 'Sistemu',

      // Common UI Elements
      save: 'Chekwaa',
      cancel: 'Kagbuo',
      close: 'Mechie',
      open: 'Meghee',
      edit: 'Dezie',
      delete: 'Hichapụ',
      create: 'Mepụta',
      update: 'Melite',
      loading: 'Na-ebu...',
      error: 'Njehie',
      success: 'Ihe ịga nke ọma',
      warning: 'Ịdọ aka ná ntị',
      info: 'Ozi',
      add: 'Tinye',
      remove: 'Wepụ',
      retry: 'Nwaa ọzọ',

      // Shakespeare Main Page
      buildNostrApps: 'Wuo ngwa na AI',
      whatToBuild: 'Gịnị ka ị chọrọ iwu?',
      chooseModel: 'Họrọ ụdịdị...',
      selectModelToDescribe: "Biko họrọ ụdịdị n'okpuru, wee kọwaa ihe ị chọrọ iwu...",
      examplePrompt: "ọmụmaatụ, Mepụta ahịa ngwá ọrụ ugbo maka ndị ọrụ ugbo mpaghara ịzụta na ire traktọ, ngwá ọrụ, na ngwa...",

      // Settings Page
      settingsDescription: 'Jikwaa ntọala ngwa gị na nhọrọ.',
      aiSettings: 'Ntọala AI',
      aiSettingsDescription: 'Hazie ndị na-enye AI na igodo API',
      gitSettings: 'Ntọala Git',
      gitSettingsDescription: 'Hazie nzere Git maka nkwenye HTTP',
      nostrSettings: 'Ntọala Nostr',
      nostrSettingsDescription: 'Hazie njikọ relay na nhọrọ Nostr',
      storageSettings: 'Nchekwa',
      storageSettingsDescription: 'Bupụta faịlụ na jikwaa data mpaghara',
      emailUpdates: 'Nmelite Email',
      emailUpdatesDescription: 'Debanye aha maka nmelite Shakespeare na akụrụngwa',

      // Project Sidebar
      newProject: 'Ọrụ Ọhụrụ',
      importRepository: 'Bubata Repository',
      noProjectsYet: 'Enwebeghị ọrụ ọ bụla',
      createFirstProject: 'Mepụta ọrụ mbụ gị iji malite',
      closeSidebar: 'Mechie sidebar',
      collapseSidebar: 'Gbakọọ sidebar',

      // Chat Interface
      welcomeToShakespeare: 'Nnọọ na Shakespeare',
      aiAssistantReady: 'Onye enyemaka mmepe AI gị adịla njikere inyere gị aka iwu, dezie, ma melite ọrụ gị.',
      askMeFeatures: '💡 Rịọ m ka m tinye atụmatụ ọhụrụ',
      requestEdits: '📝 Rịọ maka mmezi faịlụ na nkwalite',
      getHelp: '🔧 Nweta enyemaka na debugging na optimization',
      buildDeploy: '🚀 Wuo ma bufee ọrụ gị',
      aiNotConfigured: 'Onye Enyemaka AI Ahazighị',
      askToAddFeatures: 'Rịọ m ka m tinye atụmatụ, dezie faịlụ, ma ọ bụ wuo ọrụ gị...',
      selectModelFirst: 'Biko họrọ ụdịdị iji malite ikwu okwu...',
      sendMessage: 'Ziga ozi',
      stopGeneration: 'Kwụsị mmepụta',
      running: 'Na-agba ọsọ',

      // Project View Navigation
      chat: 'Nkata',
      preview: 'Nlele',
      code: 'Koodu',
      backToPreview: 'Laghachi na Nlele',

      // Preview Pane
      projectPreview: 'Nlele Ọrụ',
      buildProjectToSeePreview: 'Wuo ọrụ gị iji hụ nlele ebe a',
      fileEditor: 'Onye Ndezie Faịlụ',
      selectFileFromExplorer: 'Họrọ faịlụ site na explorer iji dezie',
      openFileExplorer: 'Meghee File Explorer',

      // File Editor
      unsavedChanges: 'Mgbanwe ndị na-echekwaghị',
      saving: 'Na-echekwa...',
      languageLabel: 'Asụsụ',

      // File Tree
      searchFiles: 'Chọọ faịlụ...',
      noFilesFound: 'Ahụghị faịlụ ọ bụla',
      noFilesFoundSearch: 'Ahụghị faịlụ ọ bụla dabara na nchọgharị gị',

      // Git Dialog
      gitRepositoryStatus: 'Ọnọdụ Repository Git',
      repositoryStatusDescription: 'Lee ọnọdụ repository wee jikọọ na repositories dị anya',
      repositoryInformation: 'Ozi Repository',
      currentBranch: 'Alaka Ugbu a',
      totalCommits: 'Mkpokọta Commits',
      latestCommit: 'Commit kacha ọhụrụ',
      remotes: 'Ndị dị anya',
      notGitRepository: 'Ọ bụghị repository Git',
      gitAuthentication: 'Nkwenye',
      credentialsDescription: 'Nzere maka ọrụ push/pull',
      configured: 'Ahaziri',
      noCredentials: 'Enweghị nzere',
      noCredentialsWarning: 'Enweghị nzere ahaziri maka {{provider}}. Ọrụ push/pull nwere ike daa maka repositories nzuzo.',
      configureCredentials: 'Hazie nzere',
      syncStatus: 'Ọnọdụ Mmekọrịta',
      pull: 'Dọta',
      push: 'Kwanye',
      pulling: 'Na-adọta...',
      pushing: 'Na-akwanye...',
      upToDate: 'Emelitela',
      commitsAhead: 'Commit {{count}} n\'ihu | Commits {{count}} n\'ihu',
      commitsBehind: 'Commit {{count}} n\'azụ | Commits {{count}} n\'azụ',
      uncommittedChanges: 'Mgbanwe {{count}} na-atinyeghị | Mgbanwe {{count}} na-atinyeghị',
      noRemoteConfigured: 'Enweghị onye dị anya ahaziri',
      workingDirectoryChanges: 'Mgbanwe Directory Ọrụ',
      filesWithChanges: 'Faịlụ {{count}} nwere mgbanwe | Faịlụ {{count}} nwere mgbanwe',
      workingDirectoryClean: 'Directory ọrụ dị ọcha',
      noUncommittedChanges: 'Enweghị mgbanwe na-atinyeghị',
      cannotPush: 'Enweghị ike ịkwanye',
      cannotPull: 'Enweghị ike ịdọta',
      notGitRepoOrBranch: 'Ọ bụghị repository git ma ọ bụ enweghị alaka ugbu a',
      noRemoteRepositories: 'Enweghị repositories dị anya ahaziri',
      nothingToPush: 'Enweghị ihe ọ bụla ịkwanye',
      noCommitsAhead: 'Enweghị commits n\'ihu nke onye dị anya. Buru ụzọ tinye mgbanwe gị.',
      pushSuccessful: 'Nkwanye gara nke ọma',
      pushFailed: 'Nkwanye dara',
      pullSuccessful: 'Ndọta gara nke ọma',
      pullFailed: 'Ndọta dara',

      // AI Settings
      aiSettingsDescriptionLong: 'Hazie ndị na-enye AI site na ịtinye igodo API gị. Ntọala na-echekwa onwe ya ma chekwaa ya na mpaghara na browser gị.',
      configuredProviders: 'Ndị Na-enye Ahaziri',
      addProvider: 'Tinye Onye Na-enye',
      getApiKey: 'Nweta igodo API',
      getToken: 'Nweta token',
      enterApiKey: 'Tinye igodo API gị',
      enterToken: 'Tinye token gị',
      enterCashuToken: 'Tinye token Cashu',
      addCustomProvider: 'Tinye Onye Na-enye Omenala',
      providerName: 'Aha Onye Na-enye',
      baseUrl: 'URL Ntọala',
      apiKey: 'Igodo API',
      authentication: 'Nkwenye',
      useCorsProxy: 'Jiri CORS Proxy',
      addCustomProviderButton: 'Tinye Onye Na-enye Omenala',
      providerExists: 'Onye na-enye nwere aha a adịlarị',
      agreeToTermsOfService: 'Ekwenyere m na {{providerName}}',
      termsOfService: 'Usoro Ọrụ',
      custom: 'Omenala',
      connecting: 'Na-ejikọ...',
      connectToGitHub: 'Jikọọ na GitHub',
      loginToNostrRequired: 'Banye na Nostr iji jiri onye na-enye a',
      goToNostrSettings: 'Gaa na Ntọala Nostr',

      // Git Settings
      gitSettingsDescriptionLong: 'Hazie nzere Git maka nkwenye HTTP. Ntọala na-echekwa onwe ya ma chekwaa ya na mpaghara na browser gị.',
      configuredCredentials: 'Nzere Ahaziri',
      origin: 'Mmalite',
      username: 'Aha onye ọrụ',
      password: 'Okwuntughe',
      enterPassword: 'Tinye okwuntughe/token gị',
      credentialsExist: 'Nzere maka mmalite a adịlarị',
      projectTemplate: 'Ụdịdị Ọrụ',
      projectTemplateDescription: 'URL nchekwa Git iji mee ka ụdịdị mmalite maka ọrụ ọhụrụ.',
      corsProxy: 'CORS Proxy',
      corsProxyDescription: 'Sava proxy ejiri gafere CORS maka ọrụ AI na Git.',
      deployServer: 'Sava Nnyefe',
      deployServerDescription: 'Ngalaba sava ebe a ga-eziga ọrụ.',

      // Data Settings
      dataSettingsDescriptionLong: 'Bupụta faịlụ ma jikwaa data mpaghara.',
      exportFiles: 'Bupụta Faịlụ',
      exportFilesDescription: 'Budata ọrụ gị niile na faịlụ dị ka mkpokọta ZIP. Nke a gụnyere faịlụ ọrụ niile, ntọala, na data echekwara na mpaghara.',
      exportAllFiles: 'Bupụta Faịlụ Niile',
      exporting: 'Na-ebupụta...',
      clearAllData: 'Hichapụ Data Niile',
      clearAllDataDescription: 'Hichapụ data mpaghara niile kpamkpam gụnyere ọrụ, ntọala, na ozi cache. Omume a enweghị ike ịmegharị.',
      clearing: 'Na-ehichapụ...',
      areYouSure: 'Ị ji n\'ezie kwenye?',
      clearDataWarning: 'Omume a ga-ehichapụ data mpaghara niile site na browser a kpamkpam, gụnyere:',
      allProjects: 'Ọrụ niile na faịlụ ha',
      aiSettingsAndKeys: 'Ntọala AI na igodo API',
      gitCredentialsSettings: 'Nzere Git na ntọala',
      userPreferences: 'Nhọrọ onye ọrụ na isiokwu',
      cachedData: 'Data cache na ozi oge',
      actionCannotBeUndone: 'Omume a enweghị ike ịmegharị. Tụlee ibupụ faịlụ gị mbụ.',
      yesClearAllData: 'Ee, hichapụ data niile',
      used: 'Ejiri',
      available: 'Dị',
      usagePercentage: '{{percentage}}% ejiri',
      usageUnavailable: 'Pasent ojiji adịghị',
      loadingStorageInfo: 'Na-ebu ozi nchekwa...',
      filesExportedSuccessfully: 'Ebupụtara faịlụ nke ọma',
      filesExportedDescription: 'Ebudata faịlụ ọrụ gị dị ka faịlụ zip.',
      failedToExportFiles: 'O dara ibupụta faịlụ',
      dataClearedSuccessfully: 'Ehichapụrụ data nke ọma',
      dataClearedDescription: 'Ewepụrụ data mpaghara niile. Na-atụgharị gaa na ibe ụlọ...',
      failedToClearData: 'O dara ihichapụ data',
      persistData: 'Chekwaa Data Ogologo Oge',
      persistDataDescription: 'Rịọ nchekwa na-adịgide adịgide iji gbochie mfu data mgbe nchekwa browser dị ala. Nke a na-enyere aka ichebe ọrụ gị na ntọala.',
      persistentStorageGranted: 'Enyere nchekwa na-adịgide adịgide',
      persistentStorageGrantedDescription: 'Browser gị ga-echebe data gị ugbu a site na nhicha akpaaka.',
      persistentStorageAlreadyGranted: 'Enyerela nchekwa na-adịgide adịgide',
      persistentStorageAlreadyGrantedDescription: 'Echebeela data gị site na nhicha akpaaka.',
      persistentStorageDenied: 'Ajụrụ arịrịọ nchekwa na-adịgide adịgide',
      persistentStorageDeniedDescription: 'Browser gị jụrụ arịrịọ ahụ. Enwere ike ihichapụ data akpaaka mgbe nchekwa dị ala.',
      persistentStorageNotSupported: 'Akwadoghị nchekwa na-adịgide adịgide',
      persistentStorageNotSupportedDescription: 'Browser gị akwadoghị arịrịọ nchekwa na-adịgide adịgide.',
      failedToRequestPersistentStorage: 'O dara ịrịọ nchekwa na-adịgide adịgide',

      // About Settings
      aboutShakespeare: 'Gbasara Shakespeare',
      aboutShakespeareDescription: 'Ozi gbasara Shakespeare.',
      sourceCode: 'Koodu Isi',
      description: 'Nkọwa',
      license: 'Ikike',
      loadingLicense: 'Na-ebu ikike...',
      failedToLoadLicense: 'O dara ibu ikike',

      // 404 Page
      pageNotFound: 'Ewoo! Ahụghị ibe',
      returnToHome: 'Laghachi n\'Ụlọ',

      // Model Selector
      selectOrEnterModel: 'Họrọ ma ọ bụ tinye ụdịdị...',
      searchModels: 'Chọọ ụdịdị...',
      enterCustomModel: 'Tinye ụdịdị omenala...',
      manageProviders: 'Jikwaa ndị na-enye...',
      noModelsFound: 'Ahụghị ụdịdị ọ bụla.',
      tryCustomModel: 'Gbalịa iji ụdịdị omenala kama.',
      recentlyUsed: 'Ejiri Na Nso Nso A',
      errorLoadingModels: 'Njehie Na-ebu Ụdịdị',

      // Context and Cost
      contextUsage: 'Ojiji ọnọdụ: {{tokens}} / {{total}} tokens ({{percentage}}%)',
      totalCostSession: 'Mkpokọta ọnụ ahịa maka oge nkata a',

      // File Status
      added: 'tinyere',
      deleted: 'hichapụrụ',
      modified: 'gbanwere',
      staged: 'kwadoro',
      untracked: 'na-esoghị',

      // Settings Layout
      toggleSidebar: 'Gbanwee sidebar',
      openSidebar: 'Meghee sidebar',

      // Nostr Settings
      nostrSettingsDescriptionLong: 'Hazie ntọala njikọ Nostr gị na nhọrọ relay.',
      nostrAccounts: 'Akaụntụ Nostr',
      noAccountsLoggedIn: 'Enweghị akaụntụ banyere. Tinye akaụntụ iji malite.',
      createAccount: 'Mepụta Akaụntụ',
      addExistingAccount: 'Tinye Akaụntụ Dị Adị',
      addAccount: 'Tinye Akaụntụ',
      relayConfiguration: 'Nhazi Relay',
      selectedRelay: 'Relay Ahọrọ',

      // Clone Page
      cloneGitRepository: 'Clone repository Git n\'ogige ọrụ Shakespeare gị',
      pleaseEnterRepositoryUrl: 'Biko tinye URL repository',
      pleaseEnterValidGitUrl: 'Biko tinye URL repository Git ziri ezi ma ọ bụ URI clone Nostr (ọmụmaatụ: nostr://npub.../aha-repo)',
      cloningRepository: 'Na-eclone Repository...',
      nostrRepositoryImportedSuccessfully: 'Ebubatara repository Nostr nke ọma',
      repositoryClonedFromNostr: 'Eclonere "{{repoName}}" site na Nostr ma dịkwa njikere maka mmepe.',
      repositoryImportedSuccessfully: 'Ebubatara repository nke ọma',
      repositoryClonedReady: 'Eclonere "{{repoName}}" ma dịkwa njikere maka mmepe.',
      failedToImportRepository: 'O dara ibubata repository',
      repositoryNotFoundOnNostr: 'Ahụghị repository na netwọk Nostr. Biko lelee URI wee nwaa ọzọ.',
      noCloneUrlsFound: 'Ahụrụ mkpọsa repository mana enweghị URL clone dị.',
      allCloneAttemptsFailed: 'Ahụrụ repository mana URL clone niile dara. Repository nwere ike ọ dịghị.',
      repositoryNotFound: 'Ahụghị repository. Biko lelee URL wee nwaa ọzọ.',
      accessDenied: 'Ajụrụ ohere. Repository nwere ike bụrụ nke nzuzo ma ọ bụ chọrọ nkwenye.',
      networkError: 'Njehie netwọk. Biko lelee njikọ gị wee nwaa ọzọ.',
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