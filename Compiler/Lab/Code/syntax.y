%code requires {
#include "ast.h"
}

/* Parser implementation: includes, globals, helpers */
%{
#include "ast.h"
#include <stdarg.h>
#include <stdio.h>

extern int yylex(void);
extern int yylineno;
extern int previous_token_line;
extern int current_token_line;
extern int previous_token_kind;
extern int current_token_kind;
extern int sync_before_current_token;

/* Syntax error flag and last reported lines to avoid duplicate diagnostics */
int has_syntax_error = 0;
extern int has_lexical_error;
extern int last_lexical_error_line;
static int last_syntax_error_line = -1;
static int pending_discarded_line_report = 0;
static int discarded_line_anchor = 0;
void yyerror(const char *msg);
static void report_syntax_error_at_line(int line, const char *msg);
static void report_discarded_token_line(int line);

ASTNode *root = NULL;
static ASTNode *make_node(NodeType type, const char *name, int line, int child_count, ...);
%}

/* Enable location tracking (@n, yylloc); Verbose error messages */
%locations
%define parse.error verbose
%expect 1

%union {
  ASTNode *node;
}

/* Tokens&Non-terminals carrying ast nodes from lexer */
%token <node> INT FLOAT ID TYPE
%token <node> SEMI COMMA ASSIGNOP RELOP PLUS MINUS STAR DIV AND OR DOT NOT
%token <node> LP RP LB RB LC RC
%token <node> STRUCT RETURN IF ELSE WHILE

%destructor {
  report_discarded_token_line(@$.first_line);
  free_ast($$);
} INT FLOAT ID TYPE SEMI COMMA ASSIGNOP RELOP PLUS MINUS STAR DIV AND OR DOT NOT LP RP LB RB LC RC STRUCT RETURN IF ELSE WHILE

%type <node> Program ExtDefList ExtDef ExtDecList Specifier StructSpecifier OptTag Tag
%type <node> VarDec FunDec VarList ParamDec CompSt StmtList Stmt
%type <node> DefList Def DecList Dec Exp Args

/* Operator precedence and associativity */
%right ASSIGNOP
%left OR
%left AND
%left RELOP
%left PLUS MINUS
%left STAR DIV
%precedence UMINUS NOT
%precedence LB DOT

%precedence LOWER_THAN_ELSE
%precedence ELSE

/* Start symbol */
%start Program

%%

/* High-level Definitions */
Program
  : ExtDefList
    {
      $$ = make_node(NODE_PROGRAM, "Program", $1 ? $1->line : 1, 1, $1);
      root = $$;
    }
  ;

ExtDefList
  : ExtDef ExtDefList
    { $$ = make_node(NODE_EXTDEFLIST, "ExtDefList", $1 ? $1->line : ($2 ? $2->line : 0), 2, $1, $2); }
  | %empty
    { $$ = NULL; }
  ;

ExtDef
  : Specifier ExtDecList SEMI
    { $$ = make_node(NODE_EXTDEF, "ExtDef", $1 ? $1->line : @3.first_line, 3, $1, $2, $3); }
  | Specifier SEMI
    { $$ = make_node(NODE_EXTDEF, "ExtDef", $1 ? $1->line : @2.first_line, 2, $1, $2); }
  | Specifier FunDec CompSt
    { $$ = make_node(NODE_EXTDEF, "ExtDef", $1 ? $1->line : ($2 ? $2->line : @3.first_line), 3, $1, $2, $3); }
  | Specifier error CompSt /* Error in function definition; Skip it */
    {
      free_ast($1);
      free_ast($3);
      yyerrok;
      $$ = NULL;
    }
  | Specifier error SEMI /* Error in external declaration; Skip to SEMI */
    {
      free_ast($1);
      free_ast($3);
      yyerrok;
      $$ = NULL;
    }
  | error SEMI
    {
      free_ast($2);
      yyerrok;
      $$ = NULL;
    }
  ;

ExtDecList
  : VarDec
    { $$ = make_node(NODE_EXTDECLIST, "ExtDecList", $1 ? $1->line : 0, 1, $1); }
  | VarDec COMMA ExtDecList
    { $$ = make_node(NODE_EXTDECLIST, "ExtDecList", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  ;

/* Specifiers */
Specifier
  : TYPE
    { $$ = make_node(NODE_SPECIFIER, "Specifier", @1.first_line, 1, $1); }
  | StructSpecifier
    { $$ = make_node(NODE_SPECIFIER, "Specifier", $1 ? $1->line : 0, 1, $1); }
  ;

StructSpecifier
  : STRUCT OptTag LC DefList RC
    { $$ = make_node(NODE_STRUCTSPECIFIER, "StructSpecifier", @1.first_line, 5, $1, $2, $3, $4, $5); }
  | STRUCT Tag
    { $$ = make_node(NODE_STRUCTSPECIFIER, "StructSpecifier", @1.first_line, 2, $1, $2); }
  | STRUCT error LC DefList RC /* Error in struct tag; Skip to LC */
    {
      free_ast($1);
      free_ast($3);
      free_ast($4);
      free_ast($5);
      yyerrok;
      $$ = NULL;
    }
  | STRUCT OptTag LC error RC /* Error in struct body; Skip it */
    {
      free_ast($1);
      free_ast($2);
      free_ast($3);
      free_ast($5);
      yyerrok;
      $$ = NULL;
    }
  ;

OptTag
  : ID
    { $$ = make_node(NODE_OPTTAG, "OptTag", @1.first_line, 1, $1); }
  | %empty
    { $$ = NULL; }
  ;

Tag
  : ID
    { $$ = make_node(NODE_TAG, "Tag", @1.first_line, 1, $1); }
  ;

/* Declarators */
VarDec
  : ID
    { $$ = make_node(NODE_VARDEC, "VarDec", @1.first_line, 1, $1); }
  | VarDec LB INT RB
    { $$ = make_node(NODE_VARDEC, "VarDec", $1 ? $1->line : @2.first_line, 4, $1, $2, $3, $4); }
  | VarDec LB error RB /* Error inside the brackets; Skip it */
    {
      free_ast($2);
      free_ast($4);
      yyerrok;
      $$ = $1;
    }
  ;

FunDec
  : ID LP VarList RP
    { $$ = make_node(NODE_FUNDEC, "FunDec", @1.first_line, 4, $1, $2, $3, $4); }
  | ID LP RP
    { $$ = make_node(NODE_FUNDEC, "FunDec", @1.first_line, 3, $1, $2, $3); }
  | ID LP error RP /* Error in parameter list; Skip it */
    {
      free_ast($1);
      free_ast($2);
      free_ast($4);
      yyerrok;
      $$ = NULL;
    }
  | ID LP error /* Error in function head */
    {
      free_ast($1);
      free_ast($2);
      yyerrok;
      $$ = NULL;
    }
  ;

VarList
  : ParamDec COMMA VarList
    { $$ = make_node(NODE_VARLIST, "VarList", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | ParamDec
    { $$ = make_node(NODE_VARLIST, "VarList", $1 ? $1->line : 0, 1, $1); }
  ;

ParamDec
  : Specifier VarDec
    { $$ = make_node(NODE_PARAMDEC, "ParamDec", $1 ? $1->line : ($2 ? $2->line : 0), 2, $1, $2); }
  | Specifier error /* Error in parameter declaration */
    {
      free_ast($1);
      yyerrok;
      $$ = NULL;
    }
  ;

/* Statements */
CompSt
  : LC DefList StmtList RC
    { $$ = make_node(NODE_COMPST, "CompSt", @1.first_line, 4, $1, $2, $3, $4); }
  | LC error RC /* Error in compound statement; Skip it */
    {
      free_ast($1);
      free_ast($3);
      yyerrok;
      $$ = NULL;
    }
  ;

StmtList
  : Stmt StmtList
    { $$ = make_node(NODE_STMTLIST, "StmtList", $1 ? $1->line : ($2 ? $2->line : 0), 2, $1, $2); }
  | %empty
    { $$ = NULL; }
  ;

Stmt
  : Exp SEMI
    { $$ = make_node(NODE_STMT, "Stmt", $1 ? $1->line : @2.first_line, 2, $1, $2); }
  | CompSt
    { $$ = make_node(NODE_STMT, "Stmt", $1 ? $1->line : 0, 1, $1); }
  | RETURN Exp SEMI
    { $$ = make_node(NODE_STMT, "Stmt", @1.first_line, 3, $1, $2, $3); }
  | RETURN error SEMI /* Error after RETURN; Skip to SEMI */
    {
      free_ast($1);
      free_ast($3);
      yyerrok;
      $$ = NULL;
    }
  | IF LP Exp RP Stmt %prec LOWER_THAN_ELSE
    { $$ = make_node(NODE_STMT, "Stmt", @1.first_line, 5, $1, $2, $3, $4, $5); }
  | IF LP Exp RP Stmt ELSE Stmt
    { $$ = make_node(NODE_STMT, "Stmt", @1.first_line, 7, $1, $2, $3, $4, $5, $6, $7); }
  | IF LP error RP Stmt %prec LOWER_THAN_ELSE /* Error in IF condition; Skip it */
    {
      free_ast($1);
      free_ast($2);
      free_ast($4);
      free_ast($5);
      yyerrok;
      $$ = NULL;
    }
  | IF LP error RP Stmt ELSE Stmt /* Error in IF condition; Skip it */
    {
      free_ast($1);
      free_ast($2);
      free_ast($4);
      free_ast($5);
      free_ast($6);
      free_ast($7);
      yyerrok;
      $$ = NULL;
    }
  | WHILE LP Exp RP Stmt
    { $$ = make_node(NODE_STMT, "Stmt", @1.first_line, 5, $1, $2, $3, $4, $5); }
  | WHILE LP error RP Stmt /* Error in WHILE condition; Skip it */
    {
      free_ast($1);
      free_ast($2);
      free_ast($4);
      free_ast($5);
      yyerrok;
      $$ = NULL;
    }
  | Exp error SEMI /* Error after expression; Skip to SEMI */
    {
      free_ast($1);
      free_ast($3);
      yyerrok;
      $$ = NULL;
    }
  | Exp error /* Error after expression; Skip it */
    {
      free_ast($1);
      yyerrok;
      $$ = NULL;
    }
  | error SEMI
    {
      free_ast($2);
      yyerrok;
      $$ = NULL;
    }
  ;

/* Local Definitions */
DefList
  : Def DefList
    { $$ = make_node(NODE_DEFLIST, "DefList", $1 ? $1->line : ($2 ? $2->line : 0), 2, $1, $2); }
  | %empty
    { $$ = NULL; }
  ;

Def
  : Specifier DecList SEMI
    { $$ = make_node(NODE_DEF, "Def", $1 ? $1->line : @3.first_line, 3, $1, $2, $3); }
  | Specifier error SEMI /* Error in declaration list; Skip to SEMI */
    {
      free_ast($1);
      free_ast($3);
      yyerrok;
      $$ = NULL;
    }
  ;

DecList
  : Dec
    { $$ = make_node(NODE_DECLIST, "DecList", $1 ? $1->line : 0, 1, $1); }
  | Dec COMMA DecList
    { $$ = make_node(NODE_DECLIST, "DecList", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Dec COMMA error /* Error after COMMA in declaration list */
    { yyerrok; $$ = make_node(NODE_DECLIST, "DecList", $1 ? $1->line : @2.first_line, 2, $1, $2); }
  ;

Dec
  : VarDec
    { $$ = make_node(NODE_DEC, "Dec", $1 ? $1->line : 0, 1, $1); }
  | VarDec ASSIGNOP Exp
    { $$ = make_node(NODE_DEC, "Dec", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | VarDec ASSIGNOP error /* Error in initializer; Skip it */
    { yyerrok; $$ = make_node(NODE_DEC, "Dec", $1 ? $1->line : @2.first_line, 2, $1, $2); }
  ;

/* Expressions */
Exp
  : Exp ASSIGNOP Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp AND Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp OR Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp RELOP Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp PLUS Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp MINUS Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp STAR Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp DIV Exp
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | LP Exp RP
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 3, $1, $2, $3); }
  | MINUS Exp %prec UMINUS
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 2, $1, $2); }
  | NOT Exp
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 2, $1, $2); }
  | ID LP Args RP
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 4, $1, $2, $3, $4); }
  | ID LP RP
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 3, $1, $2, $3); }
  | Exp LB Exp RB
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 4, $1, $2, $3, $4); }
  | Exp DOT ID
    { $$ = make_node(NODE_EXP, "Exp", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | ID
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 1, $1); }
  | INT
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 1, $1); }
  | FLOAT
    { $$ = make_node(NODE_EXP, "Exp", @1.first_line, 1, $1); }
  ;

Args
  : Exp COMMA Args
    { $$ = make_node(NODE_ARGS, "Args", $1 ? $1->line : @2.first_line, 3, $1, $2, $3); }
  | Exp
    { $$ = make_node(NODE_ARGS, "Args", $1 ? $1->line : 0, 1, $1); }
  | Exp COMMA error /* Error after COMMA in arguments; Skip it */
    { yyerrok; $$ = make_node(NODE_ARGS, "Args", $1 ? $1->line : @2.first_line, 2, $1, $2); }
  ;

%%

static ASTNode *make_node(NodeType type, const char *name, int line, int child_count, ...) {
  ASTNode *node;
  va_list args;
  int i;

  node = new_node(type, name, line);
  va_start(args, child_count);
  for (i = 0; i < child_count; ++i) {
    add_child(node, va_arg(args, ASTNode *));
  }
  va_end(args);

  if (node->line == 0) {
    for (i = 0; i < node->child_count; ++i) {
      if (node->children[i] != NULL && node->children[i]->line > 0) {
        node->line = node->children[i]->line;
        break;
      }
    }
  }

  return node;
}

static void report_syntax_error_at_line(int line, const char *msg) {
  if (line == last_lexical_error_line || line == last_syntax_error_line) {
    return;
  }

  last_syntax_error_line = line;
  has_syntax_error = 1;
  printf("Error type B at Line %d: %s.\n", line, msg);
}

static void report_discarded_token_line(int line) {
  if (!pending_discarded_line_report || line <= discarded_line_anchor) {
    return;
  }

  pending_discarded_line_report = 0;
  report_syntax_error_at_line(line, "syntax error");
}

void yyerror(const char *msg) {
  int line = current_token_line ? current_token_line :
             (yylloc.first_line ? yylloc.first_line : yylineno);

  if (line == previous_token_line + 1 && previous_token_line > 0 &&
      current_token_kind != SEMI && current_token_kind != RC &&
      current_token_kind != TYPE && current_token_kind != STRUCT &&
      current_token_kind != ELSE &&
      previous_token_kind != SEMI && previous_token_kind != RC &&
      previous_token_kind != RP && previous_token_kind != LC) {
    line = previous_token_line;
  }

  /* Suppress cascade only when an ID error steal the next line's TYPE token */
  pending_discarded_line_report =
      sync_before_current_token && (previous_token_kind == ID);
  discarded_line_anchor = current_token_line;
  report_syntax_error_at_line(line, msg);
}

/* The fixed lab Makefile does not link lex.yy.o, so fold the scanner into syntax.tab.o. */
#include "lex.yy.c"
