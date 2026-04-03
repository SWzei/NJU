#ifndef AST_H
#define AST_H

typedef enum {
  NODE_PROGRAM,
  NODE_EXTDEFLIST,
  NODE_EXTDEF,
  NODE_EXTDECLIST,
  NODE_SPECIFIER,
  NODE_STRUCTSPECIFIER,
  NODE_OPTTAG,
  NODE_TAG,
  NODE_VARDEC,
  NODE_FUNDEC,
  NODE_VARLIST,
  NODE_PARAMDEC,
  NODE_COMPST,
  NODE_STMTLIST,
  NODE_STMT,
  NODE_DEFLIST,
  NODE_DEF,
  NODE_DECLIST,
  NODE_DEC,
  NODE_EXP,
  NODE_ARGS,
  NODE_TERMINAL // Leaf nodes in ast
} NodeType;

typedef enum {
  AST_VALUE_ID,   // Lexeme string
  AST_VALUE_TYPE, // Type keywords rather than constants
  AST_VALUE_INT,
  AST_VALUE_FLOAT,
  AST_VALUE_NONE // Other tokens which contain no value
} ASTValueKind;  // Terminal

typedef struct ASTNode {
  NodeType type;
  char *name;
  int line;
  ASTValueKind value_kind;
  char *text; // For TYPE(lexeme) or TYPE(type_name)
  int int_val;
  float float_val;
  struct ASTNode **children; // Dynamic reallocate
  int child_count;
  int child_capacity;
} ASTNode;

ASTNode *new_node(NodeType type, const char *name, int line);
ASTNode *new_terminal(const char *name, int line);
ASTNode *new_terminal_id(const char *lexeme, int line);
ASTNode *new_terminal_type(const char *type_name, int line);
ASTNode *new_terminal_int(int value, int line);
ASTNode *new_terminal_float(float value, int line);
void add_child(ASTNode *parent, ASTNode *child);
void print_ast(const ASTNode *root, int indent);
void free_ast(ASTNode *root);

#endif
