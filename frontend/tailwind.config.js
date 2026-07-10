/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                aws: {
                    navy: '#232F3E',
                    navyLight: '#37475A',
                    orange: '#FF9900',
                    blue: '#0972D3',
                    blueHover: '#0558A8',
                    blueDark: '#033160',
                    gray: '#F2F3F3',
                    border: '#D5DBDB',
                    text: '#16191F',
                    textMuted: '#687078',
                    success: '#037F0C',
                    error: '#D13212',
                    sidebar: '#FAFAFA',
                },
            },
            boxShadow: {
                card: '0 1px 4px 0 rgba(0,0,0,0.08)',
                dropdown: '0 4px 16px rgba(0,0,0,0.14)',
            },
        },
    },
    plugins: [],
};
