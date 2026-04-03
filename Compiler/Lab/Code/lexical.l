%{
#include "syntax.tab.h"
#include "ast.h"
#include <stdio.h>
#include <stdlib.h>

extern YYLTYPE yylloc;

/* Column tracking for location info; reset on newline since \n yycolumn = 1*/
int yycolumn = 1;
int has_lexical_error = 0;
int last_lexical_error_line = -1;
int previous_token_line = 0;
int current_token_line = 0;
int previous_token_kind = 0;
int current_token_kind = 0;
int sync_before_current_token = 0;
static int line_has_sync_token = 0;

/* Nesting depth and start line for block comments */
static int comment_depth = 0;
static int comment_start_line = 0;

static void report_lexical_error(int line, const char *detail);
static void report_lexical_error_with_text(int line, const char *prefix, const char *text);
static void escape_text(char *dst, size_t size, const char *src);
static void note_token(int token, int line);

/* Runs before every action after matching*/
#define YY_USER_ACTION                                                        \
  do {                                                                        \
    yylloc.first_line = yylineno;                                             \
    yylloc.first_column = yycolumn;                                           \
    yylloc.last_line = yylineno;                                              \
    yylloc.last_column = yycolumn + yyleng - 1;                               \
    yycolumn += yyleng;                                                       \
  } while (0);
%}

%option noyywrap nodefault yylineno nounput noinput

/* --- alias for regular expression definition --- */
digit               [0-9]
nonzero_digit       [1-9]
letter              [a-zA-Z_]
id_char             [a-zA-Z0-9_]
hex_digit           [0-9a-fA-F]
oct_digit           [0-7]

hex_int             0[xX]{hex_digit}+
octal_int           0{oct_digit}+
decimal_int         0|{nonzero_digit}{digit}*
simple_float        {digit}+\.{digit}+
scientific_base     ({digit}+\.{digit}*|\.{digit}+)
scientific_float    {scientific_base}[Ee][+-]?{digit}+

/* --- invalid patterns listed before valid ones so Flex matches them for lexical error --- */
invalid_scientific  {scientific_base}[Ee][+-]?
invalid_hex_prefix  0[xX]
invalid_hex_suffix  0[xX]{hex_digit}*[g-zG-Z_]{id_char}*
invalid_octal       0{oct_digit}*[89]{id_char}*
invalid_octal_suffix 0{oct_digit}+{letter}{id_char}*
invalid_scientific_nodot {digit}+[Ee][+-]?{digit}*

/* Exclusive states(%x) for comments; prevent normal rules from analysing inside */
/* BEGIN() for state switching; BEGIN(INITIAL) to quit special mode*/
%x COMMENT
%x LINECOMMENT

%%

[ \t\r]+            { /* ignore */ }
\n                  {
                      yycolumn = 1;
                      line_has_sync_token = 0;
                    }

"//"                {
                      /* --- line comment: consume everything up to newline --- */
                      BEGIN(LINECOMMENT);
                    }
<LINECOMMENT>[^\n]* { /* ignore */ }
<LINECOMMENT>\n     { yycolumn = 1; BEGIN(INITIAL); }
<LINECOMMENT><<EOF>> {
                      BEGIN(INITIAL);
                      return 0;
                    }

"/*"                {
                      /* --- block comment: record start line to report accurate error on EOF --- */
                      BEGIN(COMMENT);
                      comment_depth = 1;
                      comment_start_line = yylineno;
                    }
<COMMENT>"*/"       {
                      --comment_depth;
                      if (comment_depth == 0) {
                        BEGIN(INITIAL);
                      }
                    }
<COMMENT>\n         { yycolumn = 1; }
<COMMENT>.          { /* ignore */ }
<COMMENT><<EOF>>    {
                      /* unterminated block comment: report error at the start line */
                      report_lexical_error(comment_start_line, "Unterminated comment");
                      BEGIN(INITIAL);
                      return 0;
                    }

"int"               {
                      /* --- keywords appear before the ID rule to succeed on longest match --- */
                      note_token(TYPE, yylineno);
                      yylval.node = new_terminal_type("int", yylineno);
                      return TYPE;
                    }
"float"             { note_token(TYPE, yylineno); yylval.node = new_terminal_type("float", yylineno); return TYPE; }
"struct"            { note_token(STRUCT, yylineno); yylval.node = new_terminal("STRUCT", yylineno); return STRUCT; }
"return"            { note_token(RETURN, yylineno); yylval.node = new_terminal("RETURN", yylineno); return RETURN; }
"if"                { note_token(IF, yylineno); yylval.node = new_terminal("IF", yylineno); return IF; }
"else"              { note_token(ELSE, yylineno); yylval.node = new_terminal("ELSE", yylineno); return ELSE; }
"while"             { note_token(WHILE, yylineno); yylval.node = new_terminal("WHILE", yylineno); return WHILE; }

{letter}{id_char}*  { note_token(ID, yylineno); yylval.node = new_terminal_id(yytext, yylineno); return ID; }

{scientific_float}  {
                      /* --- float literals: invalid variants checked before valid to ensure error capture --- */
                      note_token(FLOAT, yylineno);
                      yylval.node = new_terminal_float((float)strtod(yytext, NULL), yylineno);
                      return FLOAT;
                    }
{invalid_scientific_nodot} {
                      report_lexical_error_with_text(yylineno, "Invalid scientific notation", yytext);
                    }
{invalid_scientific} {
                      report_lexical_error_with_text(yylineno, "Invalid scientific notation", yytext);
                    }
{simple_float}      {
                      note_token(FLOAT, yylineno);
                      yylval.node = new_terminal_float((float)strtod(yytext, NULL), yylineno);
                      return FLOAT;
                    }

{invalid_hex_suffix} {
                      /* --- integer literals: invalid variants checked before valid --- */
                      report_lexical_error_with_text(yylineno, "Invalid hexadecimal integer", yytext);
                    }
{hex_int}           {
                      note_token(INT, yylineno);
                      yylval.node = new_terminal_int((int)strtol(yytext, NULL, 16), yylineno);
                      return INT;
                    }
{invalid_hex_prefix} {
                      report_lexical_error_with_text(yylineno, "Invalid hexadecimal integer", yytext);
                    }

{invalid_octal}     {
                      report_lexical_error_with_text(yylineno, "Invalid octal integer", yytext);
                    }
{invalid_octal_suffix} {
                      report_lexical_error_with_text(yylineno, "Invalid octal integer", yytext);
                    }
{octal_int}         {
                      note_token(INT, yylineno);
                      yylval.node = new_terminal_int((int)strtol(yytext, NULL, 8), yylineno);
                      return INT;
                    }
{decimal_int}       {
                      note_token(INT, yylineno);
                      yylval.node = new_terminal_int((int)strtol(yytext, NULL, 10), yylineno);
                      return INT;
                    }

";"                 {
                      /* --- others tokens: punctuation and operators --- */
                      note_token(SEMI, yylineno);
                      yylval.node = new_terminal("SEMI", yylineno);
                      return SEMI;
                    }
"\xCD\xBE"          {
                      note_token(SEMI, yylineno);
                      yylval.node = new_terminal("SEMI", yylineno);
                      return SEMI;
                    }
","                 { note_token(COMMA, yylineno); yylval.node = new_terminal("COMMA", yylineno); return COMMA; }
"=="                { note_token(RELOP, yylineno); yylval.node = new_terminal("RELOP", yylineno); return RELOP; }
"!="                { note_token(RELOP, yylineno); yylval.node = new_terminal("RELOP", yylineno); return RELOP; }
">="                { note_token(RELOP, yylineno); yylval.node = new_terminal("RELOP", yylineno); return RELOP; }
"<="                { note_token(RELOP, yylineno); yylval.node = new_terminal("RELOP", yylineno); return RELOP; }
">"                 { note_token(RELOP, yylineno); yylval.node = new_terminal("RELOP", yylineno); return RELOP; }
"<"                 { note_token(RELOP, yylineno); yylval.node = new_terminal("RELOP", yylineno); return RELOP; }
"="                 { note_token(ASSIGNOP, yylineno); yylval.node = new_terminal("ASSIGNOP", yylineno); return ASSIGNOP; }
"+"                 { note_token(PLUS, yylineno); yylval.node = new_terminal("PLUS", yylineno); return PLUS; }
"-"                 { note_token(MINUS, yylineno); yylval.node = new_terminal("MINUS", yylineno); return MINUS; }
"*"                 { note_token(STAR, yylineno); yylval.node = new_terminal("STAR", yylineno); return STAR; }
"/"                 { note_token(DIV, yylineno); yylval.node = new_terminal("DIV", yylineno); return DIV; }
"&&"                { note_token(AND, yylineno); yylval.node = new_terminal("AND", yylineno); return AND; }
"||"                { note_token(OR, yylineno); yylval.node = new_terminal("OR", yylineno); return OR; }
"."                 { note_token(DOT, yylineno); yylval.node = new_terminal("DOT", yylineno); return DOT; }
"!"                 { note_token(NOT, yylineno); yylval.node = new_terminal("NOT", yylineno); return NOT; }
"("                 { note_token(LP, yylineno); yylval.node = new_terminal("LP", yylineno); return LP; }
")"                 { note_token(RP, yylineno); yylval.node = new_terminal("RP", yylineno); return RP; }
"["                 { note_token(LB, yylineno); yylval.node = new_terminal("LB", yylineno); return LB; }
"]"                 { note_token(RB, yylineno); yylval.node = new_terminal("RB", yylineno); return RB; }
"{"                 { note_token(LC, yylineno); yylval.node = new_terminal("LC", yylineno); return LC; }
"}"                 { note_token(RC, yylineno); yylval.node = new_terminal("RC", yylineno); return RC; }

.                   {
                      /* Catch-all: any unrecognized character is a type-A lexical error */
                      report_lexical_error_with_text(yylineno, "Mysterious character", yytext);
                    }

%%

/* Set flag and print error; all type-A errors reach here */
static void report_lexical_error(int line, const char *detail) {
  has_lexical_error = 1;
  last_lexical_error_line = line;
  printf("Error type A at Line %d: %s.\n", line, detail);
}

/* Format prefix & quoted text, then send to report_lexical_error */
static void report_lexical_error_with_text(int line, const char *prefix, const char *text) {
  char escaped[128];
  char message[256];

  escape_text(escaped, sizeof(escaped), text);
  snprintf(message, sizeof(message), "%s \"%s\"", prefix, escaped);
  report_lexical_error(line, message);
}

static void escape_text(char *dst, size_t size, const char *src) {
  size_t di = 0;
  const unsigned char *p = (const unsigned char *)src;

  while (*p != '\0' && di + 1 < size) {
    if (*p >= 32 && *p <= 126 && *p != '\\' && *p != '"') {
      dst[di++] = (char)*p;
    } else {
      if (di + 4 >= size) {
        break;
      }
      snprintf(dst + di, size - di, "\\x%02X", *p);
      di += 4;
    }
    ++p;
  }

  dst[di] = '\0';
}

static void note_token(int token, int line) {
  sync_before_current_token = line_has_sync_token;
  previous_token_line = current_token_line;
  current_token_line = line;
  previous_token_kind = current_token_kind;
  current_token_kind = token;

  if (token == SEMI || token == RC) {
    line_has_sync_token = 1;
  }
}
