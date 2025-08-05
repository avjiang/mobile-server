module.exports = {
    apps: [
        // {
        //     name: 'web-app',
        //     script: './src/index.ts',
        //     // interpreter: 'ts-node',
        //     interpreter: 'tsx',
        //     instances: 1,
        //     exec_mode: 'fork',
        //     autorestart: true,
        //     watch: ['./src'],
        //     error_file: './logs/error.log',
        //     out_file: './logs/out.log',
        //     // env: {
        //     //   NODE_ENV: 'development',
        //     //   PORT: 3000,
        //     // },
        // },

    {
      name: 'bayar-yuk',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
        watch: false,
        restart_delay: 2000,
        max_memory_restart: '1G',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
        // out_file: './logs/out.log',
      merge_logs: true, // Combine logs from all workers
        // env: {
        //     NODE_ENV: 'development',
        //     PORT: 8080,
        // },
        },
        
    //   {
    //     name: 'archive',
    //     script: './dist/archive.js',
    //     instances: 1,
    //     autorestart: true,
    //     watch: false,
    //     max_memory_restart: '1G',
    //     env: {
    //       NODE_ENV: 'production',
    //     },
        //   },
    ],
  };