import { Client } from '@elastic/elasticsearch'
import { MappingProperty, PropertyName } from '@elastic/elasticsearch/lib/api/types';

const client = new Client({ node: process.env.ES_URL || 'http://localhost:9200' });

export const Index: string = "jurisprudencia.9.4";
export const Properties = {
    "Original": {
        type: 'object',
        enabled: false
    },
    "Número de Processo": {
        type: 'keyword',
        normalizer: 'term_normalizer'
    },
    "ECLI": {
        type: 'keyword'
    },
    "Data": {
        type: 'date',
        format: 'dd/MM/yyyy'
    },
    "Relator Nome Profissional": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: "keyword",
                normalizer: 'term_normalizer'
            }
        }
    },
    "Relator Nome Completo": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: "keyword",
                normalizer: 'term_normalizer'
            }
        }
    },
    "Descritores": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Meio Processual": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Votação - Decisão": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Votação - Vencidos": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Votação - Declarações": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Secção": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Área": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Decisão": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Decisão (textual)": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Tribunal de Recurso": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Tribunal de Recurso - Processo": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Área Temática": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Jurisprudência Estrangeira": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Jurisprudência Internacional": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Jurisprudência Nacional": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Doutrina": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Legislação Comunitária": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Legislação Estrangeira": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Legislação Nacional": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Referências Internacionais": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Indicações Eventuais": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Referência de publicação": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Jurisprudência": {
        type: 'text',
        fielddata: true,
        fields: {
            raw: {
                type: "keyword"
            },
            keyword: {
                type: 'keyword',
                normalizer: 'term_normalizer'
            }
        }
    },
    "Sumário": {
        type: 'text',
        term_vector: 'with_positions_offsets_payloads'
    },
    "Texto": {
        type: 'text',
        term_vector: 'with_positions_offsets_payloads'
    },
    "Fonte": {
        type: 'keyword',
    },
    "URL": {
        type: 'keyword',
    },
    "UUID": {
        type: 'keyword'
    },
    "HASH":{
        type: "object",
        properties: {
            "Original": { type: "keyword" },
            "Texto": { type: "keyword" },
            "Sumário" : { type: "keyword" },
            "Processo" : { type: "keyword" }
        }
    },
    "CONTENT": {
        type: 'text'
    }
} as const;

export const deleteIndex = () => client.indices.delete({ index: Index });
export const exists = () => client.indices.exists({ index: Index });
export const create = () => client.indices.create({
    index: Index,
    mappings: {
        dynamic_date_formats: ['dd/MM/yyyy'],
        properties: Properties
    },
    settings: {
        analysis: {
            normalizer: {
                term_normalizer: {
                    type: 'custom',
                    filter: ['uppercase', 'asciifolding']
                }
            },
            analyzer: {
                default: {
                    type: 'custom',
                    char_filter: ['html_strip'],
                    filter: ['trim', 'lowercase', 'stopwords_pt', 'asciifolding'],
                    tokenizer: 'classic',
                }
            },
            filter: {
                stopwords_pt: {
                    type: 'stop',
                    ignore_case: true,
                    stopwords_path: "stopwords_pt.txt"
                }
            }
        },
        number_of_shards: 1,
        number_of_replicas: 0,
        max_result_window: 550000
    }
});

export type JurisprudenciaDocument = {
    [key in keyof typeof Properties]?: any
};
export function isValidKey(accessKey: string): accessKey is keyof JurisprudenciaDocument{
    return accessKey in Properties
} 

if( require.main == module ){

    exists().then( async exists => {
        if( !exists ){
            console.log("Creating index...", Index);
            await module.exports.create();
        }
        else{
            console.log("Index already exists", Index);
        }
    }).catch( err => {
        console.log( err );
    });
}