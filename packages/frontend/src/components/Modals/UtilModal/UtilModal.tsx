import React from 'react';
import { Link } from 'react-router-dom';

import './UtilModal.css';

interface UtilModalProps {
    className: string;
    children?: React.ReactNode;
    colorTheme: string;
    toggleColorTheme: () => void;
}

const UtilModal: React.FC<UtilModalProps> = ({ className, children, colorTheme, toggleColorTheme }) => {
    return (
      <div className={`util-modal info-popup modal ${className}`}>
          {children}
        <div className='align-child-on-line'>
            <h1>Informationen</h1>
            <button>
                <a href='https://docs.google.com/forms/d/e/1FAIpQLSdWK_9ziq8cGEWFwzc_qpTaOI1dfxTz8vHWvuDphdz-UvX1TQ/viewform?usp=sf_link' target='_blank' rel='noopener noreferrer'>
                    Gib uns Feedback!
                </a>
            </button>
        </div>
            <div>
                <ul>
                <li onClick={toggleColorTheme}>
                    {colorTheme === 'light' ? (
                        <svg xmlns='http://www.w3.org/2000/svg' width='25' height='25' viewBox='0 0 24 24' stroke-width='1.5' stroke='#2c3e50' fill='none' stroke-linecap='round' stroke-linejoin='round'>
                            <path stroke='none' d='M0 0h24v24H0z' fill='none'/>
                            <path d='M12 1.992a10 10 0 1 0 9.236 13.838c.341 -.82 -.476 -1.644 -1.298 -1.31a6.5 6.5 0 0 1 -6.864 -10.787l.077 -.08c.551 -.63 .113 -1.653 -.758 -1.653h-.266l-.068 -.006l-.06 -.002z' stroke-width='0' fill='currentColor' />
                        </svg>
                    ) : (
                        <svg xmlns='http://www.w3.org/2000/svg' width='25' height='25' viewBox='0 0 24 24' stroke-width='1.5' stroke='#2c3e50' fill='none' stroke-linecap='round' stroke-linejoin='round'>
                            <path stroke='none' d='M0 0h24v24H0z' fill='none'/>
                            <path d='M12 19a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z' stroke-width='0' fill='currentColor' />
                            <path d='M18.313 16.91l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.218 -1.567l.102 .07z' stroke-width='0' fill='currentColor' />
                            <path d='M7.007 16.993a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z' stroke-width='0' fill='currentColor' />
                            <path d='M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z' stroke-width='0' fill='currentColor' />
                            <path d='M21 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z' stroke-width='0' fill='currentColor' />
                            <path d='M6.213 4.81l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.217 -1.567l.102 .07z' stroke-width='0' fill='currentColor' />
                            <path d='M19.107 4.893a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z' stroke-width='0' fill='currentColor' />
                            <path d='M12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z' stroke-width='0' fill='currentColor' />
                            <path d='M12 7a5 5 0 1 1 -4.995 5.217l-.005 -.217l.005 -.217a5 5 0 0 1 4.995 -4.783z' stroke-width='0' fill='currentColor' />
                        </svg>
                    )}
                    </li>
                </ul>
                <ul className='align-child-on-line'>
                    <li><Link to='/impressum'>Impressum</Link></li>
                    <li><Link to='/Datenschutz'>Datenschutz</Link></li>
                    <li>
                    <a className='github-icon'href='https://github.com/FreiFahren/FreiFahren' target='_blank' rel='noopener noreferrer'>
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 97.707 97.707'>
                            <path fill-rule='evenodd' clip-rule='evenodd' d='M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z' fill='#24292f'/>
                        </svg>
                    </a>
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default UtilModal;
